# Generated by Django 5.2.1 on 2025-05-17 21:14

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0012_remove_society_residents'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RemoveField(
            model_name='profile',
            name='society',
        ),
        migrations.AddField(
            model_name='profile',
            name='societies',
            field=models.ManyToManyField(blank=True, related_name='profiles', to='core.society'),
        ),
        migrations.AlterField(
            model_name='profile',
            name='user',
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='profile', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='serviceprovider',
            name='society',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='society_service_providers', to='core.society'),
        ),
        migrations.AlterField(
            model_name='serviceprovider',
            name='user',
            field=models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='service_provider', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AlterField(
            model_name='society',
            name='service_providers',
            field=models.ManyToManyField(blank=True, related_name='societies', to='core.serviceprovider'),
        ),
    ]
