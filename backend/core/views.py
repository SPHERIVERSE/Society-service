# backend/core/views.py

from rest_framework import viewsets, generics, status
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.settings import api_settings
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import action
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Case, When, IntegerField, Count
import random
from datetime import timedelta

from .serializers import (
    SocietySerializer,
    ServiceSerializer,
    ServiceProviderSerializer,
    UserSerializer,
    ResidentRegisterSerializer,
    ProviderRegisterSerializer,
    ServiceProviderSelfManageSerializer,
    ProfileUpdateSerializer,
    RequestPasswordResetSerializer,
    ConfirmPasswordResetSerializer,
    VoteSerializer,
    VotingRequestSerializer,
    LoginSerializer,
    InitiateResidentJoinSerializer,
    InitiateProviderListingSerializer
)

from .models import (
    Society, Service, ServiceProvider, Profile, OTP,
    VotingRequest, Vote
)

# Society Viewset
class SocietyViewSet(viewsets.ModelViewSet):
    queryset = Society.objects.all()
    serializer_class = SocietySerializer

    def get_permissions(self,):
        if self.action in ['list', 'retrieve', 'service_providers', 'service_categories_with_counts']:
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return Society.objects.all()

    @action(detail=True, methods=['get'], url_path='service-providers')
    def service_providers(self, request, pk=None):
        try:
            society = self.get_object()
            service_id = request.query_params.get('service_id')

            queryset = ServiceProvider.objects.filter(societies=society, is_approved=True).prefetch_related('services')

            print(f"DEBUG SocietyViewSet (service_providers): Found {queryset.count()} approved service providers associated with society {society.name} (ID: {society.id}) before service filter.")

            if service_id:
                try:
                    service_id = int(service_id)
                    queryset = queryset.filter(services__id=service_id)
                    print(f"DEBUG SocietyViewSet (service_providers): Filtered by service ID {service_id}. Found {queryset.count()} providers.")
                except ValueError:
                    return Response({"detail": "Invalid service_id provided."}, status=status.HTTP_400_BAD_REQUEST)

            serializer = ServiceProviderSerializer(queryset, many=True)
            return Response(serializer.data)
        except ObjectDoesNotExist:
            raise NotFound("Society not found.")
        except Exception as e:
            print(f"DEBUG SocietyViewSet (service_providers action) Error: {e}")
            return Response({"detail": "An error occurred while fetching service providers."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='service-categories-with-counts')
    def service_categories_with_counts(self, request, pk=None):
        try:
            society = self.get_object()

            services_with_counts = Service.objects.annotate(
                approved_provider_count=Count(
                    'service_providers',
                    filter=Q(service_providers__societies=society, service_providers__is_approved=True)
                )
            ).filter(approved_provider_count__gt=0)

            print(f"DEBUG SocietyViewSet (service_categories_with_counts): Found {services_with_counts.count()} service categories with approved providers for society {society.name} (ID: {society.id}).")

            data = [
                {
                    'id': service.id,
                    'name': service.name,
                    'approved_provider_count': service.approved_provider_count
                }
                for service in services_with_counts
            ]

            return Response(data)

        except ObjectDoesNotExist:
            raise NotFound("Society not found.")
        except Exception as e:
            print(f"DEBUG SocietyViewSet (service_categories_with_counts action) Error: {e}")
            return Response({"detail": "An error occurred while fetching service categories with counts."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Service ViewSet
class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer

    def get_permissions(self):
        if self.action == 'list':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return Service.objects.all()


# ServiceProvider ViewSet
class ServiceProviderViewSet(viewsets.ModelViewSet):
    queryset = ServiceProvider.objects.all()
    serializer_class = ServiceProviderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ServiceProvider.objects.all()


# List voting requests initiated by the current user
class UserInitiatedVotingRequestsView(generics.ListAPIView):
    serializer_class = VotingRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = VotingRequest.objects.all().select_related(
            'society',
            'initiated_by',
            'resident_user',
            'service_provider__user'
            ).prefetch_related('votes')

        queryset = queryset.filter(initiated_by=user)
        queryset = queryset.order_by('-created_at')

        print(f"DEBUG UserInitiatedVotingRequestsView: Fetching initiated requests for user {user.username} ({user.id}). Queryset count: {queryset.count()}")

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            print("DEBUG UserInitiatedVotingRequestsView (list): Serialized data:", serializer.data)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        print("DEBUG UserInitiatedVotingRequestsView (list): Serialized data:", serializer.data)
        return Response(serializer.data)


# --- Authentication and Registration Views ---

# Resident Login View
class ResidentLoginView(APIView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        try:
            serializer.is_valid(raise_exception=True)
            user = serializer.validated_data['user']

            if not hasattr(user, 'profile'):
                 return Response(
                    {'detail': 'Not authorized as a resident. User profile not found.'},
                    status=status.HTTP_403_FORBIDDEN
                 )

            token, created = Token.objects.get_or_create(user=user)
            return Response({'token': token.key, 'user_id': user.id, 'username': user.username, 'user_role': 'resident'}, status=status.HTTP_200_OK)

        except ValidationError as e:
             return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"DEBUG: Resident Login Error: {e}")
            return Response({"detail": "An error occurred during login."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Provider Login View
class ProviderLoginView(APIView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        try:
            serializer.is_valid(raise_exception=True)
            user = serializer.validated_data['user']

            if not hasattr(user, 'service_provider'):
                 return Response(
                    {'detail': 'Not authorized as a service provider.'},
                    status=status.HTTP_403_FORBIDDEN
                 )

            token, created = Token.objects.get_or_create(user=user)
            return Response({'token': token.key, 'user_id': user.id, 'username': user.username, 'user_role': 'provider'}, status=status.HTTP_200_OK)

        except ValidationError as e:
             return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"DEBUG: Provider Login Error: {e}")
            return Response({"detail": "An error occurred during login."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Resident Registration View
class ResidentRegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = ResidentRegisterSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        user = serializer.save()


# Provider Registration View
class ProviderRegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = ProviderRegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service_provider = serializer.save()

        response_serializer = ServiceProviderSerializer(service_provider)

        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


# --- Profile Management Views ---

# View/Update current user's profile
class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileUpdateSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        try:
            return self.request.user.profile
        except ObjectDoesNotExist:
            raise NotFound("User profile not found.")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance = Profile.objects.prefetch_related('societies').get(pk=instance.pk)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# View/Update current service provider's profile
class ServiceProviderSelfManagementView(generics.RetrieveUpdateAPIView):
    serializer_class = ServiceProviderSelfManageSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self, queryset=None):
        user = self.request.user
        print(f"DEBUG ServiceProviderSelfManagementView: Attempting to get ServiceProvider for user {user.username} ({user.id})")
        try:
            service_provider = user.service_provider
            print(f"DEBUG ServiceProviderSelfManagementView: Found ServiceProvider: {service_provider.name} (ID: {service_provider.id})")
            return service_provider
        except ObjectDoesNotExist:
            print(f"DEBUG ServiceProviderSelfManagementView: ServiceProvider not found for user {user.username} ({user.id}).")
            raise NotFound("Service provider profile not found.")

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        print(f"DEBUG ServiceProviderSelfManagementView: Serialized ServiceProvider data: {serializer.data}")
        return Response(serializer.data)


# List societies the current user is a resident of
class MySocietyListView(generics.ListAPIView):
    serializer_class = SocietySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'profile') and user.profile.societies.exists():
            return user.profile.societies.all()
        return Society.objects.none()


# --- Password Reset Views ---

class RequestPasswordResetView(APIView):
    serializer_class = RequestPasswordResetSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        return Response({"detail": "Password reset OTP sent if email exists."}, status=status.HTTP_200_OK)


class ConfirmPasswordResetView(APIView):
    serializer_class = ConfirmPasswordResetSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        new_password = serializer.validated_data['new_password']

        user.set_password(new_password)
        user.save()

        return Response({"detail": "Password has been reset successfully."}, status=status.HTTP_200_OK)


# --- Voting Views ---

# Helper function to check and update VotingRequest status
def check_and_update_voting_request_status(voting_request):
    """
    Checks the vote counts for a voting request and updates its status.
    If approved votes >= 5, status becomes 'approved'.
    If rejected votes >= 3, status becomes 'rejected'.
    If expired, status becomes 'expired'.
    Also updates ServiceProvider.is_approved for provider listing requests.
    """
    if voting_request.status != 'pending':
        return

    approved_votes, rejected_votes = voting_request.count_votes()

    if approved_votes >= 5:
        voting_request.status = 'approved'
        if voting_request.request_type == 'resident_join' and voting_request.resident_user:
             with transaction.atomic():
                 try:
                     profile = voting_request.resident_user.profile
                     if voting_request.society not in profile.societies.all():
                         profile.societies.add(voting_request.society)
                         profile.save()
                         print(f"DEBUG Voting Status Update: Resident {voting_request.resident_user.username} added to society {voting_request.society.name}.")
                     else:
                          print(f"DEBUG Voting Status Update: Resident {voting_request.resident_user.username} was already in society {voting_request.society.name}.")
                 except ObjectDoesNotExist:
                     print(f"ERROR Voting Status Update: Profile not found for user {voting_request.resident_user.username}.")
        elif voting_request.request_type == 'provider_list' and voting_request.service_provider:
             with transaction.atomic():
                 try:
                     service_provider = voting_request.service_provider
                     if voting_request.society not in service_provider.societies.all():
                         service_provider.societies.add(voting_request.society)
                         print(f"DEBUG Voting Status Update: Service Provider {service_provider.name} linked to society {voting_request.society.name}.")

                     if not service_provider.is_approved:
                         service_provider.is_approved = True
                         print(f"DEBUG Voting Status Update: Service Provider {service_provider.name} is_approved set to True.")

                     service_provider.save()

                 except ObjectDoesNotExist:
                     print(f"ERROR Voting Status Update: Service Provider not found for request {voting_request.id}.")

    elif rejected_votes >= 3:
        voting_request.status = 'rejected'

    elif voting_request.expiry_time < timezone.now():
        voting_request.status = 'expired'

    if voting_request.status != 'pending':
        voting_request.save()
        print(f"DEBUG Voting Status Update: Voting request {voting_request.id} status updated to '{voting_request.status}'.")


class VotingRequestViewSet(viewsets.ModelViewSet):
    queryset = VotingRequest.objects.all()
    serializer_class = VotingRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = VotingRequest.objects.all().select_related(
            'society',
            'initiated_by',
            'resident_user',
            'service_provider__user'
        ).prefetch_related('votes', 'service_provider__services')

        if hasattr(user, 'profile') and user.profile.societies.exists():
            user_societies = user.profile.societies.all()
            queryset = queryset.filter(
                society__in=user_societies,
                status='pending'
            ).exclude(initiated_by=user)

            print(f"DEBUG VotingRequestViewSet: Filtering voting requests for Resident {user.username} ({user.id}) based on societies: {[s.name for s in user_societies]} and status=pending. Queryset count: {queryset.count()}")

        elif hasattr(user, 'service_provider'):
             queryset = VotingRequest.objects.none()
             print(f"DEBUG VotingRequestViewSet: User {user.username} ({user.id}) is a Service Provider. Returning empty queryset for voting.")

        else:
            queryset = VotingRequest.objects.none()
            print(f"DEBUG VotingRequestViewSet: User {user.username} ({user.id}) is not associated with any societies or is not a resident/provider. Returning empty queryset for voting.")

        # Check and update status for pending requests
        pending_requests_in_queryset = list(queryset)
        for request in pending_requests_in_queryset:
             check_and_update_voting_request_status(request)

        # Re-fetch the queryset after potential status updates
        queryset = VotingRequest.objects.all().select_related(
            'society',
            'initiated_by',
            'resident_user',
            'service_provider__user'
        ).prefetch_related('votes', 'service_provider__services')

        if hasattr(user, 'profile') and user.profile.societies.exists():
            user_societies = user.profile.societies.all()
            queryset = queryset.filter(
                society__in=user_societies,
                status='pending'
            ).exclude(initiated_by=user)
        elif hasattr(user, 'service_provider'):
             queryset = VotingRequest.objects.none()
        else:
             queryset = VotingRequest.objects.none()

        queryset = queryset.order_by('-created_at')

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            print("DEBUG VotingRequestViewSet (list): Serialized data:", serializer.data)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        print("DEBUG VotingRequestViewSet (list): Serialized data:", serializer.data)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], serializer_class=VoteSerializer)
    def vote(self, request, pk=None):
        voting_request = self.get_object()
        serializer = VoteSerializer(data=request.data, context={'request': request, 'voting_request': voting_request})

        try:
            serializer.is_valid(raise_exception=True)

            vote_type = serializer.validated_data['vote_type']

            vote = Vote.objects.create(request=voting_request, voter=request.user, vote_type=vote_type)

            voting_request.refresh_from_db()
            check_and_update_voting_request_status(voting_request)

            return Response({'detail': 'Vote recorded successfully.'}, status=status.HTTP_200_OK)

        except ValidationError as e:
             print(f"DEBUG VotingRequestViewSet (vote action) Validation Error: {e.detail}")
             return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"DEBUG VotingRequestViewSet (vote action) Error: {e}")
            return Response({"detail": "An error occurred while recording the vote."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# New View to list societies available for the current resident to join
class AvailableSocietiesForResidentView(generics.ListAPIView):
    serializer_class = SocietySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'profile'):
            return Society.objects.none()

        user_society_ids = user.profile.societies.values_list('id', flat=True)

        queryset = Society.objects.exclude(id__in=user_society_ids)

        print(f"DEBUG AvailableSocietiesForResidentView: User {user.username} ({user.id}) is in societies: {list(user_society_ids)}. Available societies count: {queryset.count()}")

        queryset = queryset.annotate(resident_count=Count('profiles'))

        return queryset

# New View to list societies available for the current service provider to list services in
class AvailableSocietiesForServiceProviderView(generics.ListAPIView):
    serializer_class = SocietySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        print(f"DEBUG AvailableSocietiesForServiceProviderView: Checking user {user.username} ({user.id}) for service provider status.")
        if not hasattr(user, 'service_provider'):
            print(f"DEBUG AvailableSocietiesForServiceProviderView: User {user.username} ({user.id}) is not a service provider. Returning empty queryset.")
            return Society.objects.none()

        service_provider = user.service_provider
        print(f"DEBUG AvailableSocietiesForServiceProviderView: User is a service provider: {service_provider.name} (ID: {service_provider.id}).")

        associated_society_ids = service_provider.societies.values_list('id', flat=True)
        print(f"DEBUG AvailableSocietiesForServiceProviderView: Provider associated society IDs: {list(associated_society_ids)}")

        pending_request_society_ids = VotingRequest.objects.filter(
            request_type='provider_list',
            service_provider=service_provider,
            status='pending'
        ).values_list('society_id', flat=True)
        print(f"DEBUG AvailableSocietiesForServiceProviderView: Provider pending request society IDs: {list(pending_request_society_ids)}")

        excluded_society_ids = list(associated_society_ids) + list(pending_request_society_ids)
        print(f"DEBUG AvailableSocietiesForServiceProviderView: Combined excluded society IDs: {excluded_society_ids}")

        queryset = Society.objects.exclude(id__in=excluded_society_ids)

        print(f"DEBUG AvailableSocietiesForServiceProviderView: Available societies count: {queryset.count()}")

        queryset = queryset.annotate(resident_count=Count('profiles'))

        return queryset


# New View to initiate a resident join voting request
class InitiateResidentJoinVotingRequestView(generics.CreateAPIView):
    serializer_class = InitiateResidentJoinSerializer
    permission_classes = [IsAuthenticated]

    response_serializer_class = VotingRequestSerializer

    def create(self, request, *args, **kwargs):
        input_serializer = self.get_serializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated_data = input_serializer.validated_data

        user = request.user
        society = validated_data['society_id']

        if not hasattr(user, 'profile'):
            raise PermissionDenied("Only resident users can initiate join requests.")

        if user.profile.societies.filter(id=society.id).exists():
            raise ValidationError({"detail": "You are already a member of this society."})

        if VotingRequest.objects.filter(
            request_type='resident_join',
            resident_user=user,
            status='pending'
        ).exists():
            raise ValidationError({"detail": "You already have a pending join request. Please wait for it to be processed."})

        expiry_time = timezone.now() + timedelta(minutes=5)

        with transaction.atomic():
            voting_request = VotingRequest.objects.create(
                request_type='resident_join',
                society=society,
                initiated_by=user,
                resident_user=user,
                expiry_time=expiry_time,
                status='pending'
            )
            print(f"DEBUG InitiateResidentJoinVotingRequestView: Created resident join voting request {voting_request.id} for user {user.username} in society {society.name}.")

        created_request_instance = VotingRequest.objects.select_related(
            'society',
            'initiated_by',
            'resident_user',
            'service_provider__user'
        ).prefetch_related('votes').get(pk=voting_request.pk)

        response_serializer = self.response_serializer_class(created_request_instance, context={'request': request})

        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

# New View to initiate a service provider listing voting request
class InitiateServiceProviderListingVotingRequestView(generics.CreateAPIView):
    serializer_class = InitiateProviderListingSerializer
    permission_classes = [IsAuthenticated]

    response_serializer_class = VotingRequestSerializer

    def create(self, request, *args, **kwargs):
        input_serializer = self.get_serializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated_data = input_serializer.validated_data

        user = request.user
        society = validated_data['society_id']

        if not hasattr(user, 'service_provider'):
            raise PermissionDenied("Only service providers can initiate listing requests.")

        service_provider = user.service_provider

        if service_provider.societies.filter(id=society.id).exists():
            raise ValidationError({"detail": "You are already listed in this society."})

        if VotingRequest.objects.filter(
            request_type='provider_list',
            service_provider=service_provider,
            society=society,
            status='pending'
        ).exists():
            raise ValidationError({"detail": "You already have a pending listing request for this society. Please wait for it to be processed."})

        expiry_time = timezone.now() + timedelta(minutes=5)

        with transaction.atomic():
            voting_request = VotingRequest.objects.create(
                request_type='provider_list',
                society=society,
                initiated_by=user,
                service_provider=service_provider,
                expiry_time=expiry_time,
                status='pending'
            )
            print(f"DEBUG InitiateServiceProviderListingVotingRequestView: Created provider listing voting request {voting_request.id} for provider {service_provider.name} in society {society.name}.")

        created_request_instance = VotingRequest.objects.select_related(
            'society',
            'initiated_by',
            'resident_user',
            'service_provider__user'
        ).prefetch_related('votes').get(pk=voting_request.pk)

        response_serializer = self.response_serializer_class(created_request_instance, context={'request': request})

        return Response(response_serializer.data, status=status.HTTP_201_CREATED)