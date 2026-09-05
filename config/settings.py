import os
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv('APP_ENV', 'demo') == 'demo'
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'local-demo-only-never-deploy-this-key')
if not DEBUG and SECRET_KEY.startswith('local-demo'):
    raise RuntimeError('Set DJANGO_SECRET_KEY outside demo mode')
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
INSTALLED_APPS = ['django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'onboarding']
MIDDLEWARE = ['django.middleware.security.SecurityMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware']
ROOT_URLCONF = 'config.urls'
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
if os.getenv('POSTGRES_HOST'):
    DATABASES['default'] = {'ENGINE': 'django.db.backends.postgresql', 'HOST': os.environ['POSTGRES_HOST'], 'PORT': os.getenv('POSTGRES_PORT', '5432'), 'NAME': os.getenv('POSTGRES_DB', 'supplier'), 'USER': os.getenv('POSTGRES_USER', 'supplier'), 'PASSWORD': os.environ['POSTGRES_PASSWORD']}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
USE_TZ = True
TIME_ZONE = 'UTC'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024
