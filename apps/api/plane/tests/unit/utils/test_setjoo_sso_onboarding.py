# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.authentication.adapter.base import Adapter
from plane.db.models import Profile, User


def _adapter(skip):
    adapter = Adapter(request=None, provider="setjoo")
    adapter.set_user_data(
        {
            "email": "sso-user@setjoo.com",
            "user": {
                "avatar": "",
                "first_name": "Sso",
                "last_name": "User",
                "provider_id": "sub-1",
                "is_password_autoset": True,
                "skip_onboarding": skip,
            },
        }
    )
    return adapter


@pytest.mark.unit
@pytest.mark.django_db
class TestSsoSkipsOnboarding:
    def test_new_sso_user_is_onboarded(self):
        user = _adapter(True).complete_login_or_signup()
        profile = Profile.objects.get(user=user)
        assert profile.is_onboarded and profile.onboarding_step["profile_complete"]
        assert user.is_password_autoset

    def test_existing_unonboarded_sso_user_is_unblocked(self):
        user = _adapter(False).complete_login_or_signup()
        assert not Profile.objects.get(user=user).is_onboarded
        _adapter(True).complete_login_or_signup()
        assert Profile.objects.get(user=user).is_onboarded

    def test_non_sso_user_unchanged(self):
        user = _adapter(False).complete_login_or_signup()
        assert not Profile.objects.get(user=user).is_onboarded
