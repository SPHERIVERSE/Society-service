# backend/core/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

from .models import (
    Society, Service, ServiceProvider, Profile, OTP,
    VotingRequest, Vote
)

# Register your models here.

# Inline for Profile in User admin
class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = 'profile'

# Define a new User admin
class UserAdmin(BaseUserAdmin):
    inlines = (ProfileInline,)
    # Add 'is_service_provider' to list_display if you want to see it in the user list
    # list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'is_service_provider')

    # def is_service_provider(self, obj):
    #     return hasattr(obj, 'service_provider') and obj.service_provider is not None
    # is_service_provider.boolean = True
    # is_service_provider.short_description = 'Is Service Provider'


# Re-register UserAdmin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(Society)
class SocietyAdmin(admin.ModelAdmin):
    list_display = ('name', 'address', 'resident_count')
    search_fields = ('name', 'address')
    # Add 'resident_count' to readonly_fields if you calculate it dynamically
    readonly_fields = ('resident_count',)

    # Add a method to display resident count in the list view
    def resident_count(self, obj):
        return obj.profiles.count()
    resident_count.short_description = 'Number of Residents'


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ('name',)


@admin.register(ServiceProvider)
class ServiceProviderAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'display_societies', 'is_approved') # Use display_societies method
    search_fields = ('name', 'user__username', 'user__email')
    # Remove 'society' from raw_id_fields and list_filter
    # raw_id_fields = ('user',) # Keep user as raw_id_field
    # list_filter = ('is_approved',) # Filter by is_approved
    # Add a filter for societies using the ManyToManyField
    filter_horizontal = ('societies', 'services') # Use filter_horizontal for ManyToMany fields

    # Define a method to display associated societies in the list view
    def display_societies(self, obj):
        # Return a comma-separated string of society names
        return ", ".join([society.name for society in obj.societies.all()])
    display_societies.short_description = 'Associated Societies'


@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'purpose', 'created_at', 'expires_at', 'is_used')
    list_filter = ('purpose', 'is_used')
    search_fields = ('user__username', 'user__email', 'purpose')
    readonly_fields = ('otp_secret', 'created_at', 'expires_at', 'is_used') # Make these fields read-only


@admin.register(VotingRequest)
class VotingRequestAdmin(admin.ModelAdmin):
    list_display = ('request_type', 'society', 'initiated_by', 'status', 'expiry_time', 'approved_votes_count', 'rejected_votes_count')
    list_filter = ('request_type', 'status', 'society')
    search_fields = ('society__name', 'initiated_by__username', 'resident_user__username', 'service_provider__name')
    readonly_fields = ('created_at', 'updated_at', 'approved_votes_count', 'rejected_votes_count') # Add vote counts as read-only

    # Add methods to display vote counts in the list view
    def approved_votes_count(self, obj):
        return obj.votes.filter(vote_type='approve').count()
    approved_votes_count.short_description = 'Approved Votes'

    def rejected_votes_count(self, obj):
        return obj.votes.filter(vote_type='reject').count()
    rejected_votes_count.short_description = 'Rejected Votes'


@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = ('request', 'voter', 'vote_type', 'created_at')
    list_filter = ('vote_type', 'request__society')
    search_fields = ('request__id', 'voter__username', 'voter__email')
    readonly_fields = ('created_at',) # Make created_at read-only


