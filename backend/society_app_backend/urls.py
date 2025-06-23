# backend/society_app_backend/urls.py

from django.contrib import admin
from django.urls import path, include
# Correct the import statement to import views from the 'core' app
# You likely don't need to import individual views here, just include the core.urls
# from core import views # <-- Remove this line


urlpatterns = [
    path('admin/', admin.site.urls),
    # Include the urls from your core app
    # This line correctly includes all urls defined in core/urls.py under the /api/ path
    path('api/', include('core.urls')),
]

