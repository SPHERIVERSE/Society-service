# backend/core/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SocietyViewSet, ServiceViewSet, ServiceProviderViewSet,
    ResidentRegisterView, ProviderRegisterView,
    ResidentLoginView, ProviderLoginView,
    UserProfileView, ServiceProviderSelfManagementView,
    RequestPasswordResetView, ConfirmPasswordResetView,
    VotingRequestViewSet, UserInitiatedVotingRequestsView,
    AvailableSocietiesForResidentView, InitiateResidentJoinVotingRequestView,
    AvailableSocietiesForServiceProviderView, InitiateServiceProviderListingVotingRequestView,
    CountryViewSet, StateViewSet, DistrictViewSet, CircleViewSet
)

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'societies', SocietyViewSet)
router.register(r'services', ServiceViewSet)
router.register(r'serviceproviders', ServiceProviderViewSet)
# VotingRequestViewSet will handle /api/votingrequests/ and /api/votingrequests/{pk}/vote/
router.register(r'votingrequests', VotingRequestViewSet)
# Location viewsets
router.register(r'countries', CountryViewSet)
router.register(r'states', StateViewSet)
router.register(r'districts', DistrictViewSet)
router.register(r'circles', CircleViewSet)

# The API URLs are now determined automatically by the router.
urlpatterns = [
    # Place specific paths BEFORE the router include
    # Societies available for service provider to list services in
    path('societies/available-for-provider/', AvailableSocietiesForServiceProviderView.as_view(), name='available-societies-provider'),

    # Societies available for resident to join
    path('societies/available-for-resident/', AvailableSocietiesForResidentView.as_view(), name='available-societies-resident'),

    # Initiate resident join voting request
    path('votingrequests/initiate-resident-join/', InitiateResidentJoinVotingRequestView.as_view(), name='initiate-resident-join'),

    # Initiate service provider listing voting request
    path('votingrequests/initiate-provider-listing/', InitiateServiceProviderListingVotingRequestView.as_view(), name='initiate-provider-listing'),

    # Include the router URLs after specific paths
    # The router will automatically generate the URL for the custom action:
    # /api/societies/{society_pk}/service-providers/
    path('', include(router.urls)),

    # Authentication and Registration
    path('resident-register/', ResidentRegisterView.as_view(), name='resident-register'),
    path('provider-register/', ProviderRegisterView.as_view(), name='provider-register'),
    path('resident-login/', ResidentLoginView.as_view(), name='resident-login'),
    path('provider-login/', ProviderLoginView.as_view(), name='provider-login'),

    # Profile Management
    path('user-profile/', UserProfileView.as_view(), name='user-profile'), # For residents
    path('service-provider-profile/', ServiceProviderSelfManagementView.as_view(), name='service-provider-profile'), # For service providers

    # Password Reset
    path('request-password-reset/', RequestPasswordResetView.as_view(), name='request-password-reset'),
    path('confirm-password-reset/', ConfirmPasswordResetView.as_view(), name='confirm-password-reset'),

    # Voting Related
    # User initiated requests (for both residents and providers)
    path('my-initiated-voting-requests/', UserInitiatedVotingRequestsView.as_view(), name='my-initiated-voting-requests'),
]

# Debug print to show generated URL patterns
print("--- Generated URL Patterns ---")
for pattern in router.urls:
    print(pattern)
print("------------------------------")