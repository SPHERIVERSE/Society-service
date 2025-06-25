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
    VotingRequest, Vote, Country, State, District, Circle
)

# --- Location Serializers ---
class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ['id', 'name', 'code']

class StateSerializer(serializers.ModelSerializer):
    country = CountrySerializer(read_only=True)
    
    class Meta:
        model = State
        fields = ['id', 'name', 'code', 'country']

class DistrictSerializer(serializers.ModelSerializer):
    state = StateSerializer(read_only=True)
    
    class Meta:
        model = District
        fields = ['id', 'name', 'state']

class CircleSerializer(serializers.ModelSerializer):
    district = DistrictSerializer(read_only=True)
    
    class Meta:
        model = Circle
        fields = ['id', 'name', 'district']

# --- Basic Serializers ---
class SocietySerializer(serializers.ModelSerializer):
    resident_count = serializers.SerializerMethodField()
    country = CountrySerializer(read_only=True)
    state = StateSerializer(read_only=True)
    district = DistrictSerializer(read_only=True)
    circle = CircleSerializer(read_only=True)

    class Meta:
        model = Society
        fields = ['id', 'name', 'address', 'resident_count', 'country', 'state', 'district', 'circle']

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
    country = CountrySerializer(read_only=True)
    state = StateSerializer(read_only=True)
    district = DistrictSerializer(read_only=True)
    circle = CircleSerializer(read_only=True)

    class Meta:
        model = ServiceProvider
        fields = [
            'id', 'user', 'societies', 'name', 'contact_info', 'brief_note',
            'is_approved', 'created_at', 'updated_at', 'services',
            'country', 'state', 'district', 'circle'
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
    phone_number = serializers.CharField(max_length=15, write_only=True, required=False, allow_blank=True)
    
    # Location fields
    country_id = serializers.IntegerField(write_only=True)
    state_id = serializers.IntegerField(write_only=True)
    district_id = serializers.IntegerField(write_only=True)
    circle_id = serializers.IntegerField(write_only=True)
    
    society_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
        help_text="List of society IDs the resident is joining (optional)."
    )

    id = serializers.IntegerField(read_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate_country_id(self, value):
        try:
            Country.objects.get(id=value)
        except ObjectDoesNotExist:
            raise serializers.ValidationError(f"Country with ID {value} does not exist.")
        return value

    def validate_state_id(self, value):
        try:
            State.objects.get(id=value)
        except ObjectDoesNotExist:
            raise serializers.ValidationError(f"State with ID {value} does not exist.")
        return value

    def validate_district_id(self, value):
        try:
            District.objects.get(id=value)
        except ObjectDoesNotExist:
            raise serializers.ValidationError(f"District with ID {value} does not exist.")
        return value

    def validate_circle_id(self, value):
        try:
            Circle.objects.get(id=value)
        except ObjectDoesNotExist:
            raise serializers.ValidationError(f"Circle with ID {value} does not exist.")
        return value

    def validate_society_ids(self, values):
        if not values:
            return values

        for society_id in values:
            try:
                Society.objects.get(id=society_id)
            except ObjectDoesNotExist:
                raise serializers.ValidationError(f"Society with ID {society_id} does not exist.")
        return values

    def validate(self, data):
        # Validate location hierarchy
        country_id = data.get('country_id')
        state_id = data.get('state_id')
        district_id = data.get('district_id')
        circle_id = data.get('circle_id')

        try:
            country = Country.objects.get(id=country_id)
            state = State.objects.get(id=state_id, country=country)
            district = District.objects.get(id=district_id, state=state)
            circle = Circle.objects.get(id=circle_id, district=district)
        except ObjectDoesNotExist:
            raise serializers.ValidationError("Invalid location hierarchy. Please check your selections.")

        return data

    @transaction.atomic
    def create(self, validated_data):
        username = validated_data.get('username')
        email = validated_data.get('email')
        password = validated_data.get('password')

        society_ids = validated_data.pop('society_ids', [])
        phone_number = validated_data.pop('phone_number', '')
        
        # Extract location data
        country_id = validated_data.pop('country_id')
        state_id = validated_data.pop('state_id')
        district_id = validated_data.pop('district_id')
        circle_id = validated_data.pop('circle_id')
        
        validated_data.pop('password', None)

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        profile = Profile.objects.create(
            user=user,
            phone_number=phone_number,
            country_id=country_id,
            state_id=state_id,
            district_id=district_id,
            circle_id=circle_id
        )

        if society_ids:
            societies_to_add = Society.objects.filter(id__in=society_ids)
            profile.societies.set(societies_to_add)

        return user

# Provider Registration Serializer
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
    
    # Location fields
    country_id = serializers.IntegerField(write_only=True)
    state_id = serializers.IntegerField(write_only=True)
    district_id = serializers.IntegerField(write_only=True)
    circle_id = serializers.IntegerField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate_service_ids(self, values):
        if not values:
            raise serializers.ValidationError("At least one service ID must be provided.")
        for service_id in values:
            try:
                Service.objects.get(id=service_id)
            except ObjectDoesNotExist:
                raise serializers.ValidationError(f"Service with ID {service_id} does not exist.")
        return values

    def validate_country_id(self, value):
        try:
            Country.objects.get(id=value)
        except ObjectDoesNotExist:
            raise serializers.ValidationError(f"Country with ID {value} does not exist.")
        return value

    def validate_state_id(self, value):
        try:
            State.objects.get(id=value)
        except ObjectDoesNotExist:
            raise serializers.ValidationError(f"State with ID {value} does not exist.")
        return value

    def validate_district_id(self, value):
        try:
            District.objects.get(id=value)
        except ObjectDoesNotExist:
            raise serializers.ValidationError(f"District with ID {value} does not exist.")
        return value

    def validate_circle_id(self, value):
        try:
            Circle.objects.get(id=value)
        except ObjectDoesNotExist:
            raise serializers.ValidationError(f"Circle with ID {value} does not exist.")
        return value

    def validate(self, data):
        # Validate location hierarchy
        country_id = data.get('country_id')
        state_id = data.get('state_id')
        district_id = data.get('district_id')
        circle_id = data.get('circle_id')

        try:
            country = Country.objects.get(id=country_id)
            state = State.objects.get(id=state_id, country=country)
            district = District.objects.get(id=district_id, state=state)
            circle = Circle.objects.get(id=circle_id, district=district)
        except ObjectDoesNotExist:
            raise serializers.ValidationError("Invalid location hierarchy. Please check your selections.")

        return data

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
        
        # Extract location data
        country_id = validated_data.pop('country_id')
        state_id = validated_data.pop('state_id')
        district_id = validated_data.pop('district_id')
        circle_id = validated_data.pop('circle_id')

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        service_provider = ServiceProvider.objects.create(
            user=user,
            name=provider_name,
            contact_info=contact_info,
            brief_note=brief_note,
            country_id=country_id,
            state_id=state_id,
            district_id=district_id,
            circle_id=circle_id
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
    country = CountrySerializer(read_only=True)
    state = StateSerializer(read_only=True)
    district = DistrictSerializer(read_only=True)
    circle = CircleSerializer(read_only=True)

    class Meta:
        model = Profile
        fields = ['user', 'phone_number', 'societies', 'country', 'state', 'district', 'circle']
        read_only_fields = ['user']

class ServiceProviderSelfManageSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    societies = SocietySerializer(many=True, read_only=True)
    services = ServiceSerializer(many=True, read_only=True)
    country = CountrySerializer(read_only=True)
    state = StateSerializer(read_only=True)
    district = DistrictSerializer(read_only=True)
    circle = CircleSerializer(read_only=True)

    class Meta:
        model = ServiceProvider
        fields = ['id', 'user', 'societies', 'name', 'contact_info', 'brief_note', 'services', 'is_approved', 'country', 'state', 'district', 'circle']
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
        return count

    def get_rejected_votes_count(self, obj):
        """Returns the count of 'reject' votes for this request."""
        count = obj.votes.filter(vote_type='reject').count()
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
            return has_voted
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
             raise serializers.ValidationError("Voting request context is missing.")

        user_is_resident = hasattr(voter, 'profile')

        if user_is_resident and request_obj.society:
             user_societies = list(voter.profile.societies.all().values_list('id', flat=True))
             is_user_in_request_society = request_obj.society.id in user_societies
        else:
             is_user_in_request_society = False

        if Vote.objects.filter(request=request_obj, voter=voter).exists():
            raise serializers.ValidationError("You have already voted on this request.")

        if request_obj.status != 'pending':
             raise serializers.ValidationError("This voting request is no longer active.")

        if request_obj.expiry_time < timezone.now():
            raise serializers.ValidationError("This voting request is no longer active (expired).")

        if request_obj.request_type == 'resident_join':
            if not user_is_resident or not is_user_in_request_society:
                 raise serializers.ValidationError("You are not authorized to vote on this resident join request.")
        elif request_obj.request_type == 'provider_list':
             if not user_is_resident or not is_user_in_request_society:
                  raise serializers.ValidationError("You are not authorized to vote on this provider listing request.")

        if request_obj.initiated_by == voter:
             raise serializers.ValidationError("You cannot vote on your own request.")

        data['voter'] = voter
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