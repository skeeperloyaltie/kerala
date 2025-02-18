
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


import os

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'default-insecure-key')
DEBUG = True


ALLOWED_HOSTS =  ['104.37.187.187','127.0.0.1', 'smarthospitalmaintain.com', 'www.smarthospitalmaintain.com']


CORS_ALLOW_ALL_ORIGINS = True  


CORS_ALLOWED_ORIGINS = [
    'http://smarthospitalmaintain.com',
    'https://www.smarthospitalmaintain.com',
    'http://104.37.187.187',
    'https://104.37.187.187',
    'http://localhost:8000',
    'http://smarthospitalmaintain.com',

]
CORS_ALLOW_CREDENTIALS = True

AUTH_USER_MODEL = 'users.User'


INSTALLED_APPS = [
    # Core Django apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'rest_framework.authtoken',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'users',
    'appointments',
    'cookie',
    'info',
    'monitor',
]

# CSRF_TRUSTED_ORIGINS = [
#     "http://localhost",
#     "http://127.0.0.1",
#     "https://104.37.187.187",
#     "http://104.37.187.187" 
#     "http://smarthospitalmaintain.com",
#     "http://www.smarthospitalmaintain.com",
#     "https://smarthospitalmaintain.com",
#     "https://www.smarthospitalmaintain.com",
# ]
# # Application definition



REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',  # Optional, for browsing the API in a web browser
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
}

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Add this at the top

    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'kerala.urls'


TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],  # Ensure your templates directory is correctly set up
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'kerala.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'smarthospital',
        'USER': 'postgres',
        'PASSWORD': '1391',
        'HOST': 'db',  # Must match the service name in docker-compose.yml
        'PORT': '5432',
    }
}


EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = "gugod254@gmail.com"
EMAIL_HOST_PASSWORD = "payurdbuxicjzkqf"



AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')  
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'static')]  

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
