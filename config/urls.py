from django.urls import path
from onboarding import views
urlpatterns = [path('api/session', views.session), path('api/login', views.signin), path('api/logout', views.signout), path('api/cases', views.cases), path('api/cases/<int:pk>', views.case), path('api/cases/<int:pk>/documents', views.upload), path('api/cases/<int:pk>/review', views.review)]
