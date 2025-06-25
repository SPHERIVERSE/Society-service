# backend/core/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

from .models import (
    Society, Service, ServiceProvider, Profile, OTP,
    VotingRequest, Vote, Country, State, District, Circle
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

# Re-register UserAdmin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)

# Location Models Admin
@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('name', 'code')
    search_fields = ('name', 'code')

@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ('name', 'country', 'code')
    search_fields = ('name', 'country__name')
    list_filter = ('country',)

@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ('name', 'state', 'get_country')
    search_fields = ('name', 'state__name', 'state__country__name')
    list_filter = ('state__country', 'state')
    
    def get_country(self, obj):
        return obj.state.country.name
    get_country.short_description = 'Country'

@admin.register(Circle)
class CircleAdmin(admin.ModelAdmin):
    list_display = ('name', 'district', 'get_state', 'get_country')
    search_fields = ('name', 'district__name', 'district__state__name', 'district__state__country__name')
    list_filter = ('district__state__country', 'district__state', 'district')
    
    def get_state(self, obj):
        return obj.district.state.name
    get_state.short_description = 'State'
    
    def get_country(self, obj):
        return obj.district.state.country.name
    get_country.short_description = 'Country'

@admin.register(Society)
class SocietyAdmin(admin.ModelAdmin):
    list_display = ('name', 'address', 'resident_count', 'country', 'state', 'district', 'circle')
    search_fields = ('name', 'address')
    list_filter = ('country', 'state', 'district', 'circle')
    readonly_fields = ('resident_count',)

    def resident_count(self, obj):
        return obj.profiles.count()
    resident_count.short_description = 'Number of Residents'

@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')
    search_fields = ('name',)

@admin.register(ServiceProvider)
class ServiceProviderAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'display_societies', 'is_approved', 'country', 'state', 'district', 'circle')
    search_fields = ('name', 'user__username', 'user__email')
    list_filter = ('is_approved', 'country', 'state', 'district', 'circle')
    filter_horizontal = ('societies', 'services')

    def display_societies(self, obj):
        return ", ".join([society.name for society in obj.societies.all()])
    display_societies.short_description = 'Associated Societies'

@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display = ('user', 'purpose', 'created_at', 'expires_at', 'is_used')
    list_filter = ('purpose', 'is_used')
    search_fields = ('user__username', 'user__email', 'purpose')
    readonly_fields = ('otp_secret', 'created_at', 'expires_at', 'is_used')

@admin.register(VotingRequest)
class VotingRequestAdmin(admin.ModelAdmin):
    list_display = ('request_type', 'society', 'initiated_by', 'status', 'expiry_time', 'approved_votes_count', 'rejected_votes_count')
    list_filter = ('request_type', 'status', 'society')
    search_fields = ('society__name', 'initiated_by__username', 'resident_user__username', 'service_provider__name')
    readonly_fields = ('created_at', 'updated_at', 'approved_votes_count', 'rejected_votes_count')

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
    readonly_fields = ('created_at',)