# Setjoo: every project gets Cycles, Modules, Views, Pages and Intake switched on (ClickUp-style: all features on).
from django.db import migrations, models


def enable_features(apps, schema_editor):
    Project = apps.get_model("db", "Project")
    Intake = apps.get_model("db", "Intake")
    Project.objects.update(module_view=True, cycle_view=True, issue_views_view=True, page_view=True, intake_view=True)
    for project in Project.objects.filter(deleted_at__isnull=True):
        if not Intake.objects.filter(project_id=project.id, deleted_at__isnull=True).exists():
            Intake.objects.create(
                name=f"{project.name[:240]} Intake",
                project_id=project.id,
                workspace_id=project.workspace_id,
                is_default=True,
            )


class Migration(migrations.Migration):
    dependencies = [("db", "0123_chatmessage")]

    operations = [
        migrations.AlterField(model_name="project", name="module_view", field=models.BooleanField(default=True)),
        migrations.AlterField(model_name="project", name="cycle_view", field=models.BooleanField(default=True)),
        migrations.AlterField(model_name="project", name="issue_views_view", field=models.BooleanField(default=True)),
        migrations.AlterField(model_name="project", name="intake_view", field=models.BooleanField(default=True)),
        migrations.RunPython(enable_features, migrations.RunPython.noop),
    ]
