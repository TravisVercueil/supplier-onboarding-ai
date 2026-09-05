from django.db import models
class Case(models.Model):
    name = models.CharField(max_length=160)
    status = models.CharField(max_length=20, default='pending')
    corrections = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
class Document(models.Model):
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='documents')
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=30)
    pages = models.JSONField()
    fields = models.JSONField()
    mode = models.CharField(max_length=30)
    created_at = models.DateTimeField(auto_now_add=True)
class Audit(models.Model):
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='events')
    actor = models.CharField(max_length=150)
    action = models.CharField(max_length=40)
    details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
