# backend/core/models.py

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import secrets
from datetime import timedelta # Import timedelta

# Create your models here.

# User Profile Model (for Residents)
class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone_number = models.CharField(max_length=15, blank=True, null=True)
    # ManyToMany relationship with Society for residents
    societies = models.ManyToManyField('Society', related_name='profiles', blank=True) # Residents can be in multiple societies

    def __str__(self):
        return self.user.username

# Service Model
class Service(models.Model):
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

# Society Model
class Society(models.Model):
    name = models.CharField(max_length=255, unique=True)
    address = models.TextField()
    # Residents are linked via the Profile model's ManyToMany relationship

    class Meta:
        verbose_name_plural = "Societies" # <-- Corrected the plural name

    def __str__(self):
        return self.name

# Service Provider Model
class ServiceProvider(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='service_provider')
    # ManyToMany relationship with Society for service providers
    societies = models.ManyToManyField('Society', related_name='service_providers', blank=True) # Providers can be listed in multiple societies
    name = models.CharField(max_length=255) # Name of the service provider (e.g., "John's Plumbing")
    contact_info = models.CharField(max_length=255, blank=True, null=True)
    brief_note = models.TextField(blank=True, null=True)
    is_approved = models.BooleanField(default=False) # Whether the provider is approved to list services
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # ManyToMany relationship with Service for services offered
    services = models.ManyToManyField(Service, related_name='service_providers', blank=True) # Services offered by this provider


    def __str__(self):
        return self.name # Or self.user.username if you prefer


# OTP Model for password reset
class OTP(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp_secret = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    purpose = models.CharField(max_length=50) # e.g., 'password_reset'

    def is_valid(self):
        return not self.is_used and self.expires_at > timezone.now()

    def __str__(self):
        return f"OTP for {self.user.username} ({self.purpose})"

# Voting Request Model
class VotingRequest(models.Model):
    REQUEST_CHOICES = [
        ('resident_join', 'Resident Join'),
        ('provider_list', 'Service Provider Listing'),
        # Add other request types as needed
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('expired', 'Expired'),
    ]

    request_type = models.CharField(max_length=50, choices=REQUEST_CHOICES)
    society = models.ForeignKey(Society, on_delete=models.CASCADE, related_name='voting_requests')
    initiated_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='initiated_voting_requests') # The user who initiated the request
    # Fields for specific request types (can be null if not applicable)
    resident_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='resident_join_requests', null=True, blank=True) # For resident join requests
    service_provider = models.ForeignKey(ServiceProvider, on_delete=models.CASCADE, related_name='listing_requests', null=True, blank=True) # For provider listing requests

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expiry_time = models.DateTimeField() # Time when voting expires

    def is_expired(self):
        return self.status == 'pending' and self.expiry_time < timezone.now()

    def count_votes(self):
        """Counts approved and rejected votes for this request."""
        approved_votes = self.votes.filter(vote_type='approve').count()
        rejected_votes = self.votes.filter(vote_type='reject').count()
        return approved_votes, rejected_votes

    def __str__(self):
        target = ""
        if self.request_type == 'resident_join' and self.resident_user:
            target = f"Resident: {self.resident_user.username}"
        elif self.request_type == 'provider_list' and self.service_provider:
            target = f"Provider: {self.service_provider.name}"

        return f"{self.get_request_type_display()} for {self.society.name} ({self.get_status_display()}) - {target}"


# Vote Model
class Vote(models.Model):
    VOTE_CHOICES = [
        ('approve', 'Approve'),
        ('reject', 'Reject'),
    ]
    request = models.ForeignKey(VotingRequest, on_delete=models.CASCADE, related_name='votes')
    voter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='votes') # The user who cast the vote
    vote_type = models.CharField(max_length=10, choices=VOTE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('request', 'voter') # A user can only vote once per request

    def __str__(self):
        return f"{self.voter.username} voted {self.get_vote_type_display()} on Request {self.request.id}"


