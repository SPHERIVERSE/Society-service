# Generated by Django 5.2.1 on 2025-05-17 17:47

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_remove_otp_otp_code_otp_expires_at_otp_otp_secret_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='society',
            name='residents',
        ),
    ]
