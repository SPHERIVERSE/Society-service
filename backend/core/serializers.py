# backend/core/serializers.py

from rest_framework import serializers
from django.contrib.auth.models import User
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist, ValidationError as DjangoValidationError
from django.db.models import Case, When, IntegerField, Count, Q
from django.utils import timezone
from django.contrib.auth import authenticate # Import authenticate for LoginSerializer

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
        fields = ['id', 'username', 'email'] # Customize as needed


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ['id', 'name', 'description']


# ServiceProvider Serializer for displaying ServiceProvider details
class ServiceProviderSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True) # Serialize user details
    services = ServiceSerializer(many=True, read_only=True) # Serialize services provided
    # Use SocietySerializer with many=True for the ManyToMany societies field
    societies = SocietySerializer(many=True, read_only=True) # <-- Use the ManyToManyField

    class Meta:
        model = ServiceProvider
        fields = [
            'id', 'user', 'societies', 'name', 'contact_info', 'brief_note',
            'is_approved', 'created_at', 'updated_at', 'services'
        ]
        read_only_fields = ['id', 'user', 'societies', 'is_approved', 'created_at', 'updated_at'] # Make societies read-only here, updated via voting
        # Allow updating name, contact_info, brief_note, and services
        extra_kwargs = {
             'name': {'required': False}, # Make name optional for partial updates
             'contact_info': {'required': False, 'allow_blank': True},
             'brief_note': {'required': False, 'allow_blank': True},
             'services': {'required': False}
        }


    # No need for get_associated_society_names anymore as 'societies' field is used directly


# --- Authentication & Registration Serializers ---

# Resident Registration Serializer
class ResidentRegisterSerializer(serializers.Serializer):
    # Define all expected input fields
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    # Change society_id to society_ids and expect a list of integers
    # Make society_ids NOT required and remove min_length
    society_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False, # <-- Made optional
        allow_empty=True, # <-- Allow empty list
        help_text="List of society IDs the resident is joining (optional)."
    )
    phone_number = serializers.CharField(max_length=15, write_only=True, required=False, allow_blank=True)

    # Output fields after successful creation
    # These fields will be read from the returned User instance
    # Removed redundant username/email output fields as Serializer includes them by default
    id = serializers.IntegerField(read_only=True)
    # username and email will be included in output by default unless marked write_only


    # Add debug prints to validation methods
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
        # If values is empty, it's allowed now, so no validation needed
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


    @transaction.atomic # Ensure atomicity for User and Profile creation
    def create(self, validated_data):
        # DEBUG: Print validated_data to inspect its contents
        print("DEBUG: ResidentRegisterSerializer validated_data (at start of create):", validated_data)

        # Retrieve fields needed for User creation using .get() for safety
        username = validated_data.get('username')
        email = validated_data.get('email')
        password = validated_data.get('password') # password is write_only, so it should be in validated_data


        # Explicitly check if required fields are missing, even though validation passed
        if not username:
             print("DEBUG: ResidentRegisterSerializer - Username is None after .get()")
             raise serializers.ValidationError("Internal Error: Username missing from validated data during creation.")
        if not email:
             print("DEBUG: ResidentRegisterSerializer - Email is None after .get()")
             raise serializers.ValidationError("Internal Error: Email missing from validated data during creation.")
        if not password:
             print("DEBUG: ResidentRegisterSerializer - Password is None after .get()")
             raise serializers.ValidationError("Internal Error: Password missing from validated data during creation.")


        # Pop input-only fields that are not part of the User model directly
        # society_ids is now optional and can be an empty list
        society_ids = validated_data.pop('society_ids', []) # Pop as a list, default to empty list
        phone_number = validated_data.pop('phone_number', '')
        validated_data.pop('password', None) # Pop password after retrieving it


        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        # Create the profile
        profile = Profile.objects.create(
            user=user,
            phone_number=phone_number
        )

        # Link the profile to the selected societies (ManyToMany)
        # Only add societies if society_ids list is not empty
        if society_ids:
            societies_to_add = Society.objects.filter(id__in=society_ids)
            profile.societies.set(societies_to_add) # Use .set() for ManyToManyField
            print(f"DEBUG: ResidentRegisterSerializer - Profile linked to societies: {society_ids}")
        else:
             print("DEBUG: ResidentRegisterSerializer - No societies selected during registration.")


        return user # Return the created user instance


# Provider Registration View - Uses ProviderRegisterSerializer
class ProviderRegisterSerializer(serializers.Serializer):
    # Input fields
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    # Make society_id optional for initial registration
    # Note: We are removing this field from the serializer input as providers
    # select society on the dashboard now.
    # society_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    service_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        write_only=True, # Mark as write_only
        help_text="List of service IDs this provider offers."
    )
    name = serializers.CharField(max_length=255) # Name of the service provider (for ServiceProvider model)
    contact_info = serializers.CharField(max_length=255, required=False, allow_blank=True)
    brief_note = serializers.CharField(style={'base_template': 'textarea.html'}, required=False, allow_blank=True)

    # Add debug prints to validation methods
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

    # Removed validate_society_id as society_id is no longer an input field here
    # def validate_society_id(self, value):
    #     print(f"DEBUG: ProviderRegisterSerializer - validate_society_id called with value: {value}")
    #     # If value is None (because it's optional and not provided), it's valid
    #     if value is None:
    #          print("DEBUG: ProviderRegisterSerializer - society_id is None, which is allowed.")
    #          return None
    #
    #     try:
    #         society = Society.objects.get(id=value)
    #         print(f"DEBUG: ProviderRegisterSerializer - Society with ID {value} exists.")
    #     except ObjectDoesNotExist:
    #         print(f"DEBUG: ProviderRegisterSerializer - Society with ID {value} does NOT exist.")
    #         raise serializers.ValidationError("Society with this ID does not exist.")
    #     return value # Return the society object if found

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
        # Retrieve fields needed for User creation from validated_data
        username = validated_data['username']
        email = validated_data['email']
        password = validated_data['password']

        # Pop input-only fields specific to ServiceProvider or other models
        # society_id is no longer an input field here, so we don't pop it
        # society_id = validated_data.pop('society_id', None)
        service_ids = validated_data.pop('service_ids')
        validated_data.pop('password') # Pop password after getting it

        # Pop fields meant for ServiceProvider model
        provider_name = validated_data.pop('name')
        contact_info = validated_data.pop('contact_info', '')
        brief_note = validated_data.pop('brief_note', '')


        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        # Create the ServiceProvider instance without a society initially
        service_provider = ServiceProvider.objects.create(
            user=user,
            # society is not set here, it's nullable in the model
            name=provider_name,
            contact_info=contact_info,
            brief_note=brief_note
        )
        # Add services to the ManyToMany field
        services = Service.objects.filter(id__in=service_ids)
        service_provider.services.set(services) # Use .set() for ManyToMany

        # Return the created service_provider instance, not the user instance
        return service_provider # <-- Return ServiceProvider instance


# Login Serializer (for /api/resident-login/ or similar)
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

# Serializer for displaying/updating Resident Profile
class ProfileUpdateSerializer(serializers.ModelSerializer):
    # Include the related User data (username, email) using UserSerializer
    user = UserSerializer(read_only=True)

    # Profile now has a ManyToManyField called 'societies'
    # Use the SocietySerializer with many=True to include society details (like name)
    societies = SocietySerializer(many=True, read_only=True) # <-- Corrected field name and added many=True

    class Meta:
        model = Profile
        # Include 'user' and 'societies' for display
        # Allow updating 'phone_number' and potentially adding/removing societies
        fields = ['user', 'phone_number', 'societies'] # <-- Ensure 'societies' is in the fields list
        read_only_fields = ['user'] # User cannot be changed via this serializer

    # If you need to allow updating societies via this serializer, you'd add a writable field here
    # For updating the societies, you'd typically use a PrimaryKeyRelatedField with many=True
    # societies = serializers.PrimaryKeyRelatedField(queryset=Society.objects.all(), many=True, required=False)


class ServiceProviderSelfManageSerializer(serializers.ModelSerializer):
    # Include the related User data (username, email) using UserSerializer
    user = UserSerializer(read_only=True)
    # Use the ManyToManyField to display associated societies
    societies = SocietySerializer(many=True, read_only=True) # <-- Use the ManyToManyField
    services = ServiceSerializer(many=True, read_only=True) # <-- Ensure services are serialized here

    class Meta:
        model = ServiceProvider
        # Include 'user' and 'societies' for display
        fields = ['id', 'user', 'societies', 'name', 'contact_info', 'brief_note', 'services', 'is_approved'] # Added 'societies' and 'is_approved'
        read_only_fields = ['id', 'user', 'societies', 'is_approved', 'created_at', 'updated_at'] # Make societies read-only here, updated via voting
        # Allow updating name, contact_info, brief_note, and services
        extra_kwargs = {
             'name': {'required': False}, # Make name optional for partial updates
             'contact_info': {'required': False, 'allow_blank': True},
             'brief_note': {'required': False, 'allow_blank': True},
             'services': {'required': False}
        }


    # This update method is for handling updates to the ServiceProvider instance itself,
    # not for adding/removing societies via voting requests.
    # The services field is read-only in the Meta class, so this update method might not be needed
    # for services if they are only set during registration or via a separate view.
    # If you need to allow updating services via this serializer, you would uncomment and adjust this:
    # services = serializers.PrimaryKeyRelatedField(
    #     queryset=Service.objects.all(),
    #     many=True,
    #     required=False
    # )
    # def update(self, instance, validated_data):
    #     services_data = validated_data.pop('services', None)
    #     instance = super().update(instance, validated_data)
    #     if services_data is not None:
    #         instance.services.set(services_data)
    #     return instance


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
    # Use ServiceProviderSerializer for the service_provider field.
    # This will include the nested services data from the ServiceProviderSerializer.
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
        user = self.context['request'].user
        if user.is_authenticated:
            has_voted = obj.votes.filter(voter=user).exists()
            print(f"DEBUG Serializer: get_has_voted called for Request {obj.id} by user {user.username}. Result: {has_voted}")
            return has_voted
        print(f"DEBUG Serializer: get_has_voted called for Request {obj.id} by unauthenticated user.")
        return False

# Serializer for casting a vote (used in the vote action)
class VoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vote
        fields = ['vote_type'] # <-- Removed 'request' and 'voter' from fields
        read_only_fields = ['voter'] # 'voter' is still read-only as it's set by the view

    def validate(self, data):
        # Access the voting_request instance from the context
        request_obj = self.context.get('voting_request')
        voter = self.context['request'].user

        if not request_obj:
             print("DEBUG VoteSerializer: voting_request not found in context.")
             raise serializers.ValidationError("Voting request context is missing.")


        print(f"DEBUG VoteSerializer: validate called for Request {request_obj.id} by user {voter.username}.")
        print(f"DEBUG VoteSerializer: Received data: {data}") # <-- Added debug print for received data
        print(f"DEBUG VoteSerializer: Request Type: {request_obj.request_type}, Request Status: {request_obj.status}, Request Expiry: {request_obj.expiry_time}")
        print(f"DEBUG VoteSerializer: Current time: {timezone.now()}")
        print(f"DEBUG VoteSerializer: Is user authenticated? {voter.is_authenticated}")
        print(f"DEBUG VoteSerializer: User ID: {voter.id}, Initiator ID: {request_obj.initiated_by.id}")
        print(f"DEBUG VoteSerializer: Does user have profile? {hasattr(voter, 'profile')}")

        # Check if the user has a profile before accessing societies
        user_is_resident = hasattr(voter, 'profile')

        if user_is_resident and request_obj.society:
             user_societies = list(voter.profile.societies.all().values_list('id', flat=True))
             print(f"DEBUG VoteSerializer: User's society IDs: {user_societies}")
             print(f"DEBUG VoteSerializer: Request society ID: {request_obj.society.id}")
             is_user_in_request_society = request_obj.society.id in user_societies
             print(f"DEBUG VoteSerializer: Is user in request society? {is_user_in_request_society}")
        else:
             print("DEBUG VoteSerializer: User is not a resident or request has no society.")
             is_user_in_request_society = False # Cannot vote if not a resident or no society

        if Vote.objects.filter(request=request_obj, voter=voter).exists():
            print(f"DEBUG VoteSerializer: User {voter.username} already voted on Request {request_obj.id}.")
            raise serializers.ValidationError("You have already voted on this request.")

        if request_obj.status != 'pending':
             print(f"DEBUG VoteSerializer: Request {request_obj.id} is not pending (status: {request_obj.status}).")
             raise serializers.ValidationError("This voting request is no longer active.")

        if request_obj.expiry_time < timezone.now():
            print(f"DEBUG VoteSerializer: Request {request_obj.id} has expired.")
            raise serializers.ValidationError("This voting request is no longer active (expired).")

        # Check if the user is authorized to vote based on request type and society membership
        if request_obj.request_type == 'resident_join':
            # Only residents of the society can vote on resident join requests
            if not user_is_resident or not is_user_in_request_society:
                 print(f"DEBUG VoteSerializer: User {voter.username} is not authorized to vote on this resident join request.")
                 raise serializers.ValidationError("You are not authorized to vote on this resident join request.")
        elif request_obj.request_type == 'provider_list':
             # Only residents of the society can vote on provider listing requests
             if not user_is_resident or not is_user_in_request_society:
                  print(f"DEBUG VoteSerializer: User {voter.username} is not a resident member of society {request_obj.society.name} (ID: {request_obj.society.id}).")
                  raise serializers.ValidationError("You are not authorized to vote on this provider listing request.")
        # Add checks for other request types if needed


        # Prevent the initiator from voting on their own request
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
            # You might add more validation here, e.g., check if the society is open for joining
            return society
        except ObjectDoesNotExist:
            raise serializers.ValidationError("Society with this ID does not exist.")

# New Serializer for initiating a service provider listing voting request
class InitiateProviderListingSerializer(serializers.Serializer): # <-- New Serializer
    society_id = serializers.IntegerField(required=True)

    def validate_society_id(self, value):
        try:
            society = Society.objects.get(id=value)
            # You might add more validation here, e.g., check if the society is accepting provider listings
            return society
        except ObjectDoesNotExist:
            raise serializers.ValidationError("Society with this ID does not exist.")


