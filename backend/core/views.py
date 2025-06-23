# backend/core/views.py

# Import necessary modules from rest_framework
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
from django.contrib.auth import authenticate # Keep authenticate for custom login
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from django.db import transaction
from django.db.models import Q, Case, When, IntegerField, Count
import random
from datetime import timedelta # Import timedelta for expiry time

# Import all serializers at the beginning of the file
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

# --- Custom Permission for Resident... (your existing custom permissions if any)

# Society Viewset - Allows listing for anyone, but requires auth for create/update/delete
class SocietyViewSet(viewsets.ModelViewSet):
    queryset = Society.objects.all()
    serializer_class = SocietySerializer

    def get_permissions(self,):
        """
        Instantiates and returns the list of permissions that this view requires.
        Allows GET (list, retrieve, service_providers, service_categories_with_counts) for any user, but requires authentication for others.
        """
        if self.action in ['list', 'retrieve', 'service_providers', 'service_categories_with_counts']: # Allow new action for any user
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated] # Or a more specific permission like IsAdminUser
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return Society.objects.all()

    @action(detail=True, methods=['get'], url_path='service-providers')
    def service_providers(self, request, pk=None):
        """
        List service providers associated with a specific society,
        optionally filtered by service category.
        """
        try:
            society = self.get_object() # Get the specific society instance
            service_id = request.query_params.get('service_id') # Get optional service_id query parameter

            # Start with all approved service providers associated with this society
            queryset = ServiceProvider.objects.filter(societies=society, is_approved=True).prefetch_related('services')

            print(f"DEBUG SocietyViewSet (service_providers): Found {queryset.count()} approved service providers associated with society {society.name} (ID: {society.id}) before service filter.")

            # Filter by service if service_id is provided
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


    @action(detail=True, methods=['get'], url_path='service-categories-with-counts') # New custom action
    def service_categories_with_counts(self, request, pk=None):
        """
        List service categories available in a society with the count of approved
        service providers for each category in that society.
        """
        try:
            society = self.get_object() # Get the specific society instance

            # Get all services and annotate with the count of approved providers in this society
            # who offer that service.
            services_with_counts = Service.objects.annotate(
                approved_provider_count=Count(
                    'service_providers',
                    filter=Q(service_providers__societies=society, service_providers__is_approved=True)
                )
            ).filter(approved_provider_count__gt=0) # Only include categories with at least one approved provider

            print(f"DEBUG SocietyViewSet (service_categories_with_counts): Found {services_with_counts.count()} service categories with approved providers for society {society.name} (ID: {society.id}).")

            # Manually serialize the data as we have the count annotation
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


# Service ViewSet - Requires authentication for most actions, but not list
class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    # permission_classes = [IsAuthenticated] # Removed default permission class

    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        Allows GET (list) for any user, but requires authentication for others.
        """
        if self.action == 'list':
            permission_classes = [AllowAny] # Allow anyone to list services
        else:
            permission_classes = [IsAuthenticated] # Require authentication for create, retrieve, update, destroy
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return Service.objects.all()


# ServiceProvider ViewSet - Requires authentication
class ServiceProviderViewSet(viewsets.ModelViewSet):
    queryset = ServiceProvider.objects.all()
    serializer_class = ServiceProviderSerializer
    permission_classes = [IsAuthenticated] # Requires authentication for all actions

    def get_queryset(self):
        return ServiceProvider.objects.all()


# List voting requests initiated by the current user (for Profile page - now also for Provider Dashboard)
class UserInitiatedVotingRequestsView(generics.ListAPIView):
    serializer_class = VotingRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Filters the queryset to return voting requests initiated by the current user,
        based on whether they are a resident (initiating join requests) or
        a service provider (initiating listing requests).
        Ensures related society data is fetched.
        """
        user = self.request.user # Get the current logged-in user
        # Use select_related and prefetch_related for performance
        queryset = VotingRequest.objects.all().select_related(
            'society', # <-- Ensure society is selected
            'initiated_by',
            'resident_user',
            'service_provider__user'
            ).prefetch_related('votes')

        # Filter by requests where the current user is the initiated_by user
        queryset = queryset.filter(initiated_by=user)

        queryset = queryset.order_by('-created_at')

        print(f"DEBUG UserInitiatedVotingRequestsView: Fetching initiated requests for user {user.username} ({user.id}). Queryset count: {queryset.count()}")

        return queryset

    # Override list method to add debug print for raw data
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            print("DEBUG UserInitiatedVotingRequestsView (list): Serialized data:", serializer.data) # Debug print
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        print("DEBUG UserInitiatedVotingRequestsView (list): Serialized data:", serializer.data) # Debug print
        return Response(serializer.data)


# --- Authentication and Registration Views ---

# Resident Login View - Uses LoginSerializer for validation
class ResidentLoginView(APIView):
    permission_classes = [AllowAny] # Allow unauthenticated access for login
    serializer_class = LoginSerializer # Use the new LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request}) # Pass request context
        try:
            serializer.is_valid(raise_exception=True)
            user = serializer.validated_data['user']

            # Corrected check: Simply ensure the user has a profile to be considered a resident.
            # Society association is now optional for login.
            if not hasattr(user, 'profile'): # <-- Removed the societies.exists() check
                 return Response(
                    {'detail': 'Not authorized as a resident. User profile not found.'},
                    status=status.HTTP_403_FORBIDDEN
                 )

            token, created = Token.objects.get_or_create(user=user)
            # Return token and basic user info upon successful login
            return Response({'token': token.key, 'user_id': user.id, 'username': user.username, 'user_role': 'resident'}, status=status.HTTP_200_OK) # Added user_role


        except ValidationError as e:
             # Return validation errors from the serializer
             return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Catch any other unexpected errors
            print(f"DEBUG: Resident Login Error: {e}") # Log the specific error on the backend
            return Response({"detail": "An error occurred during login."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Provider Login View - Uses LoginSerializer for validation
class ProviderLoginView(APIView):
    permission_classes = [AllowAny] # Allow unauthenticated access for login
    serializer_class = LoginSerializer # Use the new LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request}) # Pass request context
        try:
            serializer.is_valid(raise_exception=True)
            user = serializer.validated_data['user']

            # Additional check: Ensure the user is a service provider
            if not hasattr(user, 'service_provider'): # Use the correct related_name 'service_provider'
                 return Response(
                    {'detail': 'Not authorized as a service provider.'},
                    status=status.HTTP_403_FORBIDDEN
                 )

            token, created = Token.objects.get_or_create(user=user)
            # Return token and basic user info upon successful login
            return Response({'token': token.key, 'user_id': user.id, 'username': user.username, 'user_role': 'provider'}, status=status.HTTP_200_OK) # Added user_role


        except ValidationError as e:
             # Return validation errors from the serializer
             return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Catch any other unexpected errors
            print(f"DEBUG: Provider Login Error: {e}") # Log the specific error on the backend
            return Response({"detail": "An error occurred during login."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Resident Registration View - Uses ResidentRegisterSerializer
class ResidentRegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = ResidentRegisterSerializer
    permission_classes = [AllowAny] # Allow registration for unauthenticated users

    def perform_create(self, serializer):
        # This calls the create method in ResidentRegisterSerializer
        user = serializer.save()
        # You might want to return a success response here if needed,
        # but generics.CreateAPIView handles the response by default.


# Provider Registration View - Uses ProviderRegisterSerializer
class ProviderRegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = ProviderRegisterSerializer
    permission_classes = [AllowAny] # Allow registration for unauthenticated users

    # Override the create method to control the response serialization
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Call the serializer's save method to create the User and ServiceProvider
        # The serializer's create method should return the ServiceProvider instance
        service_provider = serializer.save() # <-- Expecting ServiceProvider here based on serializer's create method


        # Now, serialize the created ServiceProvider instance using the response serializer
        # Use the ServiceProviderSerializer for output
        response_serializer = ServiceProviderSerializer(service_provider)

        # Return the serialized ServiceProvider data in the response
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


# --- Profile Management Views ---

# View/Update current user's profile
class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileUpdateSerializer
    permission_classes = [IsAuthenticated] # Requires authentication

    def get_object(self):
        # Assuming each User has a one-to-one relationship with a Profile
        try:
            # Use the correct related_name 'profile' and prefetch societies for performance
            return self.request.user.profile
        except ObjectDoesNotExist:
            raise NotFound("User profile not found.")

    # Override retrieve method to prefetch related societies
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Ensure societies are prefetched when retrieving the profile
        instance = Profile.objects.prefetch_related('societies').get(pk=instance.pk)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# View/Update current service provider's profile
class ServiceProviderSelfManagementView(generics.RetrieveUpdateAPIView): # Changed to RetrieveUpdateAPIView
    serializer_class = ServiceProviderSelfManageSerializer
    permission_classes = [IsAuthenticated] # Requires authentication

    def get_object(self, queryset=None):
        # Assuming a user is linked to one service provider
        user = self.request.user
        print(f"DEBUG ServiceProviderSelfManagementView: Attempting to get ServiceProvider for user {user.username} ({user.id})")
        try:
            # Use the correct related_name 'service_provider'
            # Ensure related societies and services are fetched for serialization
            service_provider = user.service_provider
            print(f"DEBUG ServiceProviderSelfManagementView: Found ServiceProvider: {service_provider.name} (ID: {service_provider.id})")
            return service_provider
        except ObjectDoesNotExist:
            print(f"DEBUG ServiceProviderSelfManagementView: ServiceProvider not found for user {user.username} ({user.id}).")
            raise NotFound("Service provider profile not found.")

    # Override retrieve method to ensure correct serialization
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # Manually serialize the instance with the correct serializer
        serializer = self.get_serializer(instance)
        print(f"DEBUG ServiceProviderSelfManagementView: Serialized ServiceProvider data: {serializer.data}")
        return Response(serializer.data)


# List societies the current user is a resident of
# This view is likely redundant now that the profile view includes societies
# but keeping it in case it's used elsewhere.
class MySocietyListView(generics.ListAPIView):
    serializer_class = SocietySerializer
    permission_classes = [IsAuthenticated] # Requires authentication

    def get_queryset(self):
        user = self.request.user
        # Filter societies based on the user's profile's societies ManyToManyField
        if hasattr(user, 'profile') and user.profile.societies.exists():
            return user.profile.societies.all() # Return all societies related to the profile
        return Society.objects.none() # Return empty queryset if no societies are linked


# --- Password Reset Views ---

class RequestPasswordResetView(APIView):
    serializer_class = RequestPasswordResetSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        # Implement logic to send OTP for password reset
        # This would typically involve:
        # 1. Validate email using serializer
        # 2. Find the user
        # 3. Generate OTP (using OTP model)
        # 4. Send OTP via email (requires email backend setup)
        # 5. Return success response
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        # ... rest of your OTP generation and sending logic ...
        return Response({"detail": "Password reset OTP sent if email exists."}, status=status.HTTP_200_OK)


class ConfirmPasswordResetView(APIView):
    serializer_class = ConfirmPasswordResetSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        # Implement logic to verify OTP and reset password
        # This would typically involve:
        # 1. Validate email, OTP, and new_password using serializer
        # 2. The serializer's validate method handles OTP verification and marks it as used
        # 3. Set the user's new password
        # 4. Return success response
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
        return # Only process pending requests

    approved_votes, rejected_votes = voting_request.count_votes()

    if approved_votes >= 5:
        voting_request.status = 'approved'
        # If it's a resident join request and approved, add the resident to the society
        if voting_request.request_type == 'resident_join' and voting_request.resident_user:
             with transaction.atomic():
                 try:
                     profile = voting_request.resident_user.profile
                     # Add the resident to the society if not already a member
                     if voting_request.society not in profile.societies.all():
                         profile.societies.add(voting_request.society)
                         profile.save()
                         print(f"DEBUG Voting Status Update: Resident {voting_request.resident_user.username} added to society {voting_request.society.name}.")
                     else:
                          print(f"DEBUG Voting Status Update: Resident {voting_request.resident_user.username} was already in society {voting_request.society.name}.")
                 except ObjectDoesNotExist:
                     print(f"ERROR Voting Status Update: Profile not found for user {voting_request.resident_user.username}.")
        # If it's a provider listing request and approved, link the provider to the society AND set is_approved to True
        elif voting_request.request_type == 'provider_list' and voting_request.service_provider:
             with transaction.atomic():
                 try:
                     service_provider = voting_request.service_provider
                     # Link the provider to the society if not already linked
                     # Use the ManyToManyField 'societies' on ServiceProvider
                     if voting_request.society not in service_provider.societies.all(): # <-- Corrected access
                         service_provider.societies.add(voting_request.society) # <-- Use the ManyToManyField on ServiceProvider
                         print(f"DEBUG Voting Status Update: Service Provider {service_provider.name} linked to society {voting_request.society.name}.")

                     # Set is_approved to True for the service provider
                     if not service_provider.is_approved:
                         service_provider.is_approved = True
                         print(f"DEBUG Voting Status Update: Service Provider {service_provider.name} is_approved set to True.")

                     service_provider.save() # Save the service provider instance after changes

                 except ObjectDoesNotExist:
                     print(f"ERROR Voting Status Update: Service Provider not found for request {voting_request.id}.")


    elif rejected_votes >= 3:
        voting_request.status = 'rejected'

    elif voting_request.expiry_time < timezone.now():
        voting_request.status = 'expired'

    # Save the voting request if the status changed
    if voting_request.status != 'pending':
        voting_request.save()
        print(f"DEBUG Voting Status Update: Voting request {voting_request.id} status updated to '{voting_request.status}'.")


class VotingRequestViewSet(viewsets.ModelViewSet):
    queryset = VotingRequest.objects.all()
    serializer_class = VotingRequestSerializer
    permission_classes = [IsAuthenticated] # Requires authentication for all actions

    def get_queryset(self):
        """
        Custom queryset to filter voting requests based on the user's role and associated societies.
        Residents should only see pending requests for societies they belong to, excluding their own.
        Service Providers don't vote on requests via this view.
        Ensures related data is fetched.
        """
        user = self.request.user
        # Ensure related data is fetched here
        queryset = VotingRequest.objects.all().select_related(
            'society',
            'initiated_by',
            'resident_user',
            'service_provider__user'
        ).prefetch_related('votes', 'service_provider__services') # Pre-fetch services for provider requests


        # Filter for Residents: Show pending requests for societies they are members of, excluding their own initiated requests
        if hasattr(user, 'profile') and user.profile.societies.exists():
            user_societies = user.profile.societies.all()
            queryset = queryset.filter(
                society__in=user_societies,
                status='pending'
            ).exclude(initiated_by=user) # Residents don't vote on their own requests

            print(f"DEBUG VotingRequestViewSet: Filtering voting requests for Resident {user.username} ({user.id}) based on societies: {[s.name for s in user_societies]} and status=pending. Queryset count: {queryset.count()}")

        # Filter for Service Providers: This view is primarily for residents to vote.
        # Service providers will see their initiated requests in UserInitiatedVotingRequestsView.
        # So, if the user is a service provider, return an empty queryset for this view.
        elif hasattr(user, 'service_provider'):
             queryset = VotingRequest.objects.none()
             print(f"DEBUG VotingRequestViewSet: User {user.username} ({user.id}) is a Service Provider. Returning empty queryset for voting.")

        else:
            # If the user is neither a resident nor a service provider (or not associated with societies), they cannot vote
            queryset = VotingRequest.objects.none()
            print(f"DEBUG VotingRequestViewSet: User {user.username} ({user.id}) is not associated with any societies or is not a resident/provider. Returning empty queryset for voting.")


        # Before returning, check and update status for pending requests in the queryset
        # Note: This check runs every time the queryset is evaluated. For high traffic,
        # a separate periodic task might be more efficient for expiry checks.
        # We are already filtering by status='pending' above, so this check is primarily for expiry within the pending set.
        pending_requests_in_queryset = list(queryset) # Fetch pending requests in the filtered set
        for request in pending_requests_in_queryset:
             check_and_update_voting_request_status(request)

        # Re-fetch the queryset after potential status updates (important!)
        # We need to apply the same filters again to get the correct list after status changes
        queryset = VotingRequest.objects.all().select_related(
            'society',
            'initiated_by',
            'resident_user',
            'service_provider__user'
        ).prefetch_related('votes', 'service_provider__services') # Re-pre-fetch services


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


    # Override list method to add debug print for raw data
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            print("DEBUG VotingRequestViewSet (list): Serialized data:", serializer.data) # Debug print
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        print("DEBUG VotingRequestViewSet (list): Serialized data:", serializer.data) # Debug print
        return Response(serializer.data)


    # You can add custom actions here if needed, e.g., for voting
    @action(detail=True, methods=['post'], serializer_class=VoteSerializer)
    def vote(self, request, pk=None):
        voting_request = self.get_object() # Get the voting request instance
        serializer = VoteSerializer(data=request.data, context={'request': request, 'voting_request': voting_request}) # Pass context

        try:
            serializer.is_valid(raise_exception=True)
            # The serializer's validate method handles all eligibility checks (is member, not initiator, not voted, pending, not expired)

            # The vote_type is in validated_data
            vote_type = serializer.validated_data['vote_type']


            vote = Vote.objects.create(request=voting_request, voter=request.user, vote_type=vote_type) # Save the vote, linking it to the request, user, and vote_type

            # Check and update the voting request status after a vote is cast
            # Need to refresh the voting_request instance to get the latest vote counts
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
    permission_classes = [IsAuthenticated] # Requires authentication

    def get_queryset(self):
        user = self.request.user
        # Ensure the user has a profile
        if not hasattr(user, 'profile'):
            # If a resident somehow doesn't have a profile, they shouldn't see societies to join
            return Society.objects.none() # Return empty if no profile

        # Get the IDs of societies the user is already a member of
        user_society_ids = user.profile.societies.values_list('id', flat=True)

        # Return societies whose IDs are NOT in the user's society IDs
        queryset = Society.objects.exclude(id__in=user_society_ids)

        print(f"DEBUG AvailableSocietiesForResidentView: User {user.username} ({user.id}) is in societies: {list(user_society_ids)}. Available societies count: {queryset.count()}")

        # Pre-calculate resident count for efficiency in serializer
        queryset = queryset.annotate(resident_count=Count('profiles'))

        return queryset

# New View to list societies available for the current service provider to list services in
class AvailableSocietiesForServiceProviderView(generics.ListAPIView):
    serializer_class = SocietySerializer
    permission_classes = [IsAuthenticated] # Requires authentication

    def get_queryset(self):
        user = self.request.user
        print(f"DEBUG AvailableSocietiesForServiceProviderView: Checking user {user.username} ({user.id}) for service provider status.")
        # Ensure the user is a service provider
        if not hasattr(user, 'service_provider'):
            print(f"DEBUG AvailableSocietiesForServiceProviderView: User {user.username} ({user.id}) is not a service provider. Returning empty queryset.")
            return Society.objects.none() # Return empty if not a service provider

        service_provider = user.service_provider
        print(f"DEBUG AvailableSocietiesForServiceProviderView: User is a service provider: {service_provider.name} (ID: {service_provider.id}).")


        # Get the IDs of societies the provider is already associated with (approved)
        associated_society_ids = service_provider.societies.values_list('id', flat=True)
        print(f"DEBUG AvailableSocietiesForServiceProviderView: Provider associated society IDs: {list(associated_society_ids)}")


        # Get the IDs of societies where the provider has a pending listing request
        pending_request_society_ids = VotingRequest.objects.filter(
            request_type='provider_list',
            service_provider=service_provider,
            status='pending'
        ).values_list('society_id', flat=True)
        print(f"DEBUG AvailableSocietiesForServiceProviderView: Provider pending request society IDs: {list(pending_request_society_ids)}")


        # Combine the IDs to exclude
        excluded_society_ids = list(associated_society_ids) + list(pending_request_society_ids)
        print(f"DEBUG AvailableSocietiesForServiceProviderView: Combined excluded society IDs: {excluded_society_ids}")


        # Return societies whose IDs are NOT in the excluded list
        queryset = Society.objects.exclude(id__in=excluded_society_ids)

        print(f"DEBUG AvailableSocietiesForServiceProviderView: Available societies count: {queryset.count()}")

        # Pre-calculate resident count for efficiency in serializer (useful info for provider)
        queryset = queryset.annotate(resident_count=Count('profiles'))


        return queryset


# New View to initiate a resident join voting request
class InitiateResidentJoinVotingRequestView(generics.CreateAPIView):
    # Use InitiateResidentJoinSerializer for input validation
    serializer_class = InitiateResidentJoinSerializer
    permission_classes = [IsAuthenticated] # Requires authentication

    # Explicitly define the serializer to use for the response
    response_serializer_class = VotingRequestSerializer


    def create(self, request, *args, **kwargs):
        # Use the input serializer to validate the request data
        input_serializer = self.get_serializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated_data = input_serializer.validated_data

        user = request.user
        society = validated_data['society_id'] # Get the Society object from validation

        # Ensure the user is a resident (has a profile)
        if not hasattr(user, 'profile'):
            raise PermissionDenied("Only resident users can initiate join requests.")

        # Check if the resident is already a member of this society
        if user.profile.societies.filter(id=society.id).exists():
            raise ValidationError({"detail": "You are already a member of this society."})

        # Check: Prevent duplicate pending join requests for the same user
        if VotingRequest.objects.filter(
            request_type='resident_join',
            resident_user=user,
            status='pending'
        ).exists():
            raise ValidationError({"detail": "You already have a pending join request. Please wait for it to be processed."})

        # Calculate expiry time (5 minutes from now)
        expiry_time = timezone.now() + timedelta(minutes=5)

        # Create the VotingRequest instance
        with transaction.atomic(): # Ensure atomic creation
            voting_request = VotingRequest.objects.create(
                request_type='resident_join',
                society=society,
                initiated_by=user, # The resident initiates their own join request
                resident_user=user, # The resident is the target of the request
                expiry_time=expiry_time,
                status='pending' # Initial status is pending
            )
            print(f"DEBUG InitiateResidentJoinVotingRequestView: Created resident join voting request {voting_request.id} for user {user.username} in society {society.name}.")

        # Now, serialize the created VotingRequest instance using the response serializer
        # Need to retrieve the instance again to get related fields for serialization
        created_request_instance = VotingRequest.objects.select_related(
            'society', # <-- Ensure society is selected
            'initiated_by',
            'resident_user',
            'service_provider__user'
        ).prefetch_related('votes').get(pk=voting_request.pk)


        # Use the response_serializer_class to serialize the instance
        response_serializer = self.response_serializer_class(created_request_instance, context={'request': request})

        # Return the serialized data in the response
        # Manually create the response to avoid potential mixin issues
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

# New View to initiate a service provider listing voting request
class InitiateServiceProviderListingVotingRequestView(generics.CreateAPIView):
    # Use InitiateProviderListingSerializer for input validation
    serializer_class = InitiateProviderListingSerializer # <-- Use the new serializer
    permission_classes = [IsAuthenticated] # Requires authentication

    # Explicitly define the serializer to use for the response
    response_serializer_class = VotingRequestSerializer

    def create(self, request, *args, **kwargs):
        # Use the input serializer to validate the request data
        input_serializer = self.get_serializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        validated_data = input_serializer.validated_data

        user = request.user
        society = validated_data['society_id'] # Get the Society object from validation

        # Ensure the user is a service provider and has a ServiceProvider instance
        if not hasattr(user, 'service_provider'):
            raise PermissionDenied("Only service providers can initiate listing requests.")

        service_provider = user.service_provider

        # Check if the provider is already associated with this society (approved)
        if service_provider.societies.filter(id=society.id).exists():
            raise ValidationError({"detail": "You are already listed in this society."})

        # Check: Prevent duplicate pending listing requests for the same provider in the same society
        if VotingRequest.objects.filter(
            request_type='provider_list',
            service_provider=service_provider,
            society=society,
            status='pending'
        ).exists():
            raise ValidationError({"detail": "You already have a pending listing request for this society. Please wait for it to be processed."})

        # Calculate expiry time (5 minutes from now)
        expiry_time = timezone.now() + timedelta(minutes=5)

        # Create the VotingRequest instance
        with transaction.atomic(): # Ensure atomic creation
            voting_request = VotingRequest.objects.create(
                request_type='provider_list',
                society=society,
                initiated_by=user, # The service provider initiates their own listing request
                service_provider=service_provider, # The service provider is the target of the request
                expiry_time=expiry_time,
                status='pending' # Initial status is pending
            )
            print(f"DEBUG InitiateServiceProviderListingVotingRequestView: Created provider listing voting request {voting_request.id} for provider {service_provider.name} in society {society.name}.")


        # Now, serialize the created VotingRequest instance using the response serializer
        # Need to retrieve the instance again to get related fields for serialization
        created_request_instance = VotingRequest.objects.select_related(
            'society', # <-- Ensure society is selected
            'initiated_by',
            'resident_user',
            'service_provider__user'
        ).prefetch_related('votes').get(pk=voting_request.pk)


        # Use the response_serializer_class to serialize the instance
        response_serializer = self.response_serializer_class(created_request_instance, context={'request': request})

        # Return the serialized data in the response
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


