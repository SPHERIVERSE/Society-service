# backend/core/serializers.py

from rest_framework import serializers
from django.contrib.auth.models import User
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist, ValidationError as DjangoValidationError
from django.db.models import Case, When, IntegerField, Count, Q
from django.utils import timezone
from django.contrib.auth import authenticate

from .models import (
    Society, Service, ServiceProvider, Profile, OTP,
    VotingRequest, Vote
)

# --- Basic Serializers ---
class SocietySerializer(serializers.ModelSerializer):
     resident_count = serializers.SerializerMethodField()

     class Meta:
        model = Society
        fields = ['id', 'name', 'address', 'resident_count']

     def get_resident_count(self, obj):
         """
         Calculates the number of residents associated with this society.
         Uses the 'profiles' related_name from Profile.societies ManyToManyField.
         """
         return obj.profiles.count()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ['id', 'name', 'description']


# ServiceProvider Serializer for displaying ServiceProvider details
class ServiceProviderSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    services = ServiceSerializer(many=True, read_only=True)
    societies = SocietySerializer(many=True, read_only=True)

    class Meta:
        model = ServiceProvider
        fields = [
            'id', 'user', 'societies', 'name', 'contact_info', 'brief_note',
            'is_approved', 'created_at', 'updated_at', 'services'
        ]
        read_only_fields = ['id', 'user', 'societies', 'is_approved', 'created_at', 'updated_at']
        extra_kwargs = {
             'name': {'required': False},
             'contact_info': {'required': False, 'allow_blank': True},
             'brief_note': {'required': False, 'allow_blank': True},
             'services': {'required': False}
        }


# --- Authentication & Registration Serializers ---

# Resident Registration Serializer
class ResidentRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    society_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
        help_text="List of society IDs the resident is joining (optional)."
    )
    phone_number = serializers.CharField(max_length=15, write_only=True, required=False, allow_blank=True)

    id = serializers.IntegerField(read_only=True)

    def validate_username(self, value):
        print(f"DEBUG: ResidentRegisterSerializer - validate_username called with value: {value}")
        if User.objects.filter(username=value).exists():
            print(f"DEBUG: ResidentRegisterSerializer - Username '{value}' already exists.")
            raise serializers.ValidationError("A user with that username already exists.")
        print(f"DEBUG: ResidentRegisterSerializer - Username '{value}' is available.")
        return value

    def validate_email(self, value):
        print(f"DEBUG: ResidentRegisterSerializer - validate_email called with value: {value}")
        if User.objects.filter(email=value).exists():
            print(f"DEBUG: ResidentRegisterSerializer - Email '{value}' already exists.")
            raise serializers.ValidationError("A user with that email already exists.")
        print(f"DEBUG: ResidentRegisterSerializer - Email '{value}' is available.")
        return value

    def validate_society_ids(self, values):
        print(f"DEBUG: ResidentRegisterSerializer - validate_society_ids called with values: {values}")
        if not values:
             print("DEBUG: ResidentRegisterSerializer - society_ids is empty, which is allowed.")
             return values

        for society_id in values:
            try:
                Society.objects.get(id=society_id)
            except ObjectDoesNotExist:
                raise serializers.ValidationError(f"Society with ID {society_id} does not exist.")
        print(f"DEBUG: ResidentRegisterSerializer - All society IDs {values} exist.")
        return values

    @transaction.atomic
    def create(self, validated_data):
        print("DEBUG: ResidentRegisterSerializer validated_data (at start of create):", validated_data)

        username = validated_data.get('username')
        email = validated_data.get('email')
        password = validated_data.get('password')

        if not username:
             print("DEBUG: ResidentRegisterSerializer - Username is None after .get()")
             raise serializers.ValidationError("Internal Error: Username missing from validated data during creation.")
        if not email:
             print("DEBUG: ResidentRegisterSerializer - Email is None after .get()")
             raise serializers.ValidationError("Internal Error: Email missing from validated data during creation.")
        if not password:
             print("DEBUG: ResidentRegisterSerializer - Password is None after .get()")
             raise serializers.ValidationError("Internal Error: Password missing from validated data during creation.")

        society_ids = validated_data.pop('society_ids', [])
        phone_number = validated_data.pop('phone_number', '')
        validated_data.pop('password', None)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        profile = Profile.objects.create(
            user=user,
            phone_number=phone_number
        )

        if society_ids:
            societies_to_add = Society.objects.filter(id__in=society_ids)
            profile.societies.set(societies_to_add)
            print(f"DEBUG: ResidentRegisterSerializer - Profile linked to societies: {society_ids}")
        else:
             print("DEBUG: ResidentRegisterSerializer - No societies selected during registration.")

        return user


# Provider Registration View - Uses ProviderRegisterSerializer
class ProviderRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    service_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        write_only=True,
        help_text="List of service IDs this provider offers."
    )
    name = serializers.CharField(max_length=255)
    contact_info = serializers.CharField(max_length=255, required=False, allow_blank=True)
    brief_note = serializers.CharField(style={'base_template': 'textarea.html'}, required=False, allow_blank=True)

    def validate_username(self, value):
        print(f"DEBUG: ProviderRegisterSerializer - validate_username called with value: {value}")
        if User.objects.filter(username=value).exists():
            print(f"DEBUG: ProviderRegisterSerializer - Username '{value}' already exists.")
            raise serializers.ValidationError("A user with that username already exists.")
        print(f"DEBUG: ProviderRegisterSerializer - Username '{value}' is available.")
        return value

    def validate_email(self, value):
        print(f"DEBUG: ProviderRegisterSerializer - validate_email called with value: {value}")
        if User.objects.filter(email=value).exists():
            print(f"DEBUG: ProviderRegisterSerializer - Email '{value}' already exists.")
            raise serializers.ValidationError("A user with that email already exists.")
        print(f"DEBUG: ProviderRegisterSerializer - Email '{value}' is available.")
        return value

    def validate_service_ids(self, values):
        print(f"DEBUG: ProviderRegisterSerializer - validate_service_ids called with values: {values}")
        if not values:
            raise serializers.ValidationError("At least one service ID must be provided.")
        for service_id in values:
            try:
                Service.objects.get(id=service_id)
            except ObjectDoesNotExist:
                raise serializers.ValidationError(f"Service with ID {service_id} does not exist.")
        print(f"DEBUG: ProviderRegisterSerializer - All service IDs {values} exist.")
        return values

    @transaction.atomic
    def create(self, validated_data):
        username = validated_data['username']
        email = validated_data['email']
        password = validated_data['password']

        service_ids = validated_data.pop('service_ids')
        validated_data.pop('password')

        provider_name = validated_data.pop('name')
        contact_info = validated_data.pop('contact_info', '')
        brief_note = validated_data.pop('brief_note', '')

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        service_provider = ServiceProvider.objects.create(
            user=user,
            name=provider_name,
            contact_info=contact_info,
            brief_note=brief_note
        )
        
        services = Service.objects.filter(id__in=service_ids)
        service_provider.services.set(services)

        return service_provider


# Login Serializer
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')

        if username and password:
            user = authenticate(request=self.context.get('request'), username=username, password=password)
            if not user:
                raise serializers.ValidationError("Invalid credentials provided.")

            data['user'] = user
        else:
            raise serializers.ValidationError("Must include 'username' and 'password'.")
        return data


# --- Profile & Service Provider Management Serializers ---

class ProfileUpdateSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    societies = SocietySerializer(many=True, read_only=True)

    class Meta:
        model = Profile
        fields = ['user', 'phone_number', 'societies']
        read_only_fields = ['user']


class ServiceProviderSelfManageSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    societies = SocietySerializer(many=True, read_only=True)
    services = ServiceSerializer(many=True, read_only=True)

    class Meta:
        model = ServiceProvider
        fields = ['id', 'user', 'societies', 'name', 'contact_info', 'brief_note', 'services', 'is_approved']
        read_only_fields = ['id', 'user', 'societies', 'is_approved', 'created_at', 'updated_at']
        extra_kwargs = {
             'name': {'required': False},
             'contact_info': {'required': False, 'allow_blank': True},
             'brief_note': {'required': False, 'allow_blank': True},
             'services': {'required': False}
        }


# --- Password Reset Serializers ---

class RequestPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("No user found with this email address.")
        return value


class ConfirmPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_secret = serializers.CharField(max_length=64)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, data):
        email = data.get('email')
        otp_secret = data.get('otp_secret')

        try:
            user = User.objects.get(email=email)
            otp_instance = OTP.objects.get(
                user=user,
                otp_secret=otp_secret,
                is_used=False,
                expires_at__gt=timezone.now(),
                purpose='password_reset'
            )
        except ObjectDoesNotExist:
            raise serializers.ValidationError("Invalid or expired OTP.")

        otp_instance.is_used = True
        otp_instance.save()

        data['user'] = user
        return data


# --- Voting Serializers ---

class VotingRequestSerializer(serializers.ModelSerializer):
    initiated_by = UserSerializer(read_only=True)
    resident_user = UserSerializer(read_only=True)
    service_provider = ServiceProviderSerializer(read_only=True)
    approved_votes_count = serializers.SerializerMethodField()
    rejected_votes_count = serializers.SerializerMethodField()
    has_voted = serializers.SerializerMethodField()
    society = SocietySerializer(read_only=True)
    society_name = serializers.CharField(source='society.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    def get_approved_votes_count(self, obj):
        """Returns the count of 'approve' votes for this request."""
        count = obj.votes.filter(vote_type='approve').count()
        print(f"DEBUG Serializer: get_approved_votes_count called for Request {obj.id}. Result: {count}")
        return count

    def get_rejected_votes_count(self, obj):
        """Returns the count of 'reject' votes for this request."""
        count = obj.votes.filter(vote_type='reject').count()
        print(f"DEBUG Serializer: get_rejected_votes_count called for Request {obj.id}. Result: {count}")
        return count

    class Meta:
        model = VotingRequest
        fields = [
            'id', 'request_type', 'society', 'society_name', 'initiated_by',
            'resident_user', 'service_provider', 'status', 'status_display',
            'created_at', 'updated_at', 'expiry_time', 'approved_votes_count',
            'rejected_votes_count', 'has_voted'
        ]
        read_only_fields = [
            'initiated_by', 'status', 'status_display', 'created_at', 'updated_at',
            'approved_votes_count', 'rejected_votes_count', 'has_voted', 'society', 'society_name'
        ]

    def get_has_voted(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user = request.user
            has_voted = obj.votes.filter(voter=user).exists()
            print(f"DEBUG Serializer: get_has_voted called for Request {obj.id} by user {user.username}. Result: {has_voted}")
            return has_voted
        print(f"DEBUG Serializer: get_has_voted called for Request {obj.id} by unauthenticated user.")
        return False

# Serializer for casting a vote
class VoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vote
        fields = ['vote_type']
        read_only_fields = ['voter']

    def validate(self, data):
        request_obj = self.context.get('voting_request')
        request_context = self.context.get('request')
        
        if not request_context or not hasattr(request_context, 'user'):
            raise serializers.ValidationError("Request context is missing.")
            
        voter = request_context.user

        if not request_obj:
             print("DEBUG VoteSerializer: voting_request not found in context.")
             raise serializers.ValidationError("Voting request context is missing.")

        print(f"DEBUG VoteSerializer: validate called for Request {request_obj.id} by user {voter.username}.")
        print(f"DEBUG VoteSerializer: Received data: {data}")
        print(f"DEBUG VoteSerializer: Request Type: {request_obj.request_type}, Request Status: {request_obj.status}, Request Expiry: {request_obj.expiry_time}")
        print(f"DEBUG VoteSerializer: Current time: {timezone.now()}")
        print(f"DEBUG VoteSerializer: Is user authenticated? {voter.is_authenticated}")
        print(f"DEBUG VoteSerializer: User ID: {voter.id}, Initiator ID: {request_obj.initiated_by.id}")
        print(f"DEBUG VoteSerializer: Does user have profile? {hasattr(voter, 'profile')}")

        user_is_resident = hasattr(voter, 'profile')

        if user_is_resident and request_obj.society:
             user_societies = list(voter.profile.societies.all().values_list('id', flat=True))
             print(f"DEBUG VoteSerializer: User's society IDs: {user_societies}")
             print(f"DEBUG VoteSerializer: Request society ID: {request_obj.society.id}")
             is_user_in_request_society = request_obj.society.id in user_societies
             print(f"DEBUG VoteSerializer: Is user in request society? {is_user_in_request_society}")
        else:
             print("DEBUG VoteSerializer: User is not a resident or request has no society.")
             is_user_in_request_society = False

        if Vote.objects.filter(request=request_obj, voter=voter).exists():
            print(f"DEBUG VoteSerializer: User {voter.username} already voted on Request {request_obj.id}.")
            raise serializers.ValidationError("You have already voted on this request.")

        if request_obj.status != 'pending':
             print(f"DEBUG VoteSerializer: Request {request_obj.id} is not pending (status: {request_obj.status}).")
             raise serializers.ValidationError("This voting request is no longer active.")

        if request_obj.expiry_time < timezone.now():
            print(f"DEBUG VoteSerializer: Request {request_obj.id} has expired.")
            raise serializers.ValidationError("This voting request is no longer active (expired).")

        if request_obj.request_type == 'resident_join':
            if not user_is_resident or not is_user_in_request_society:
                 print(f"DEBUG VoteSerializer: User {voter.username} is not authorized to vote on this resident join request.")
                 raise serializers.ValidationError("You are not authorized to vote on this resident join request.")
        elif request_obj.request_type == 'provider_list':
             if not user_is_resident or not is_user_in_request_society:
                  print(f"DEBUG VoteSerializer: User {voter.username} is not a resident member of society {request_obj.society.name} (ID: {request_obj.society.id}).")
                  raise serializers.ValidationError("You are not authorized to vote on this provider listing request.")

        if request_obj.initiated_by == voter:
             print(f"DEBUG VoteSerializer: User {voter.username} is the initiator of Request {request_obj.id} and cannot vote.")
             raise serializers.ValidationError("You cannot vote on your own request.")

        data['voter'] = voter
        print(f"DEBUG VoteSerializer: Validation successful for Request {request_obj.id}.")
        return data


# New Serializer for initiating a resident join voting request
class InitiateResidentJoinSerializer(serializers.Serializer):
    society_id = serializers.IntegerField(required=True)

    def validate_society_id(self, value):
        try:
            society = Society.objects.get(id=value)
            return society
        except ObjectDoesNotExist:
            raise serializers.ValidationError("Society with this ID does not exist.")

# New Serializer for initiating a service provider listing voting request
class InitiateProviderListingSerializer(serializers.Serializer):
    society_id = serializers.IntegerField(required=True)

    def validate_society_id(self, value):
        try:
            society = Society.objects.get(id=value)
            return society
        except ObjectDoesNotExist:
            raise serializers.ValidationError("Society with this ID does not exist.")