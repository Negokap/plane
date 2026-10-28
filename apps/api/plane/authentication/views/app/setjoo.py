# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import uuid

# Django import
from django.http import HttpResponseRedirect
from django.views import View

# Module imports
from plane.authentication.provider.oauth.setjoo import SetjooOAuthProvider
from plane.authentication.utils.login import user_login
from plane.authentication.utils.pkce import generate_pkce_pair
from plane.authentication.utils.redirection_path import get_redirection_path
from plane.authentication.utils.user_auth_workflow import post_user_auth_workflow
from plane.license.models import Instance
from plane.authentication.utils.host import base_host
from plane.authentication.adapter.error import (
    AuthenticationException,
    AUTHENTICATION_ERROR_CODES,
)
from plane.utils.path_validator import get_safe_redirect_url


class SetjooOauthInitiateEndpoint(View):
    def get(self, request):
        request.session["host"] = base_host(request=request, is_app=True)
        next_path = request.GET.get("next_path")
        if next_path:
            request.session["next_path"] = str(next_path)

        # Check instance configuration
        instance = Instance.objects.first()
        if instance is None or not instance.is_setup_done:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INSTANCE_NOT_CONFIGURED"],
                error_message="INSTANCE_NOT_CONFIGURED",
            )
            params = exc.get_error_dict()
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), next_path=next_path, params=params
            )
            return HttpResponseRedirect(url)

        try:
            state = uuid.uuid4().hex
            code_verifier, code_challenge = generate_pkce_pair()
            provider = SetjooOAuthProvider(request=request, state=state, code_challenge=code_challenge)
            request.session["state"] = state
            # One-time PKCE secret, consumed and cleared in the callback.
            request.session["setjoo_code_verifier"] = code_verifier
            auth_url = provider.get_auth_url()
            return HttpResponseRedirect(auth_url)
        except AuthenticationException as e:
            params = e.get_error_dict()
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), next_path=next_path, params=params
            )
            return HttpResponseRedirect(url)


class SetjooCallbackEndpoint(View):
    def get(self, request):
        code = request.GET.get("code")
        state = request.GET.get("state")
        next_path = request.session.get("next_path")

        def _error(error_code_key):
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES[error_code_key],
                error_message=error_code_key,
            )
            params = exc.get_error_dict()
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), next_path=next_path, params=params
            )
            return HttpResponseRedirect(url)

        if state != request.session.get("state", ""):
            return _error("SETJOO_OAUTH_PROVIDER_ERROR")
        if not code:
            return _error("SETJOO_OAUTH_PROVIDER_ERROR")

        code_verifier = request.session.get("setjoo_code_verifier")
        if not code_verifier:
            return _error("SETJOO_OAUTH_PROVIDER_ERROR")

        try:
            provider = SetjooOAuthProvider(
                request=request,
                code=code,
                code_verifier=code_verifier,
                callback=post_user_auth_workflow,
            )
            user = provider.authenticate()
            # Clear the one-time PKCE verifier and state now that they're
            # consumed — the authorization code itself is already single-use
            # at Setjoo Identity's token endpoint, this just avoids leaving a
            # stale verifier sitting in the session store afterward.
            request.session.pop("setjoo_code_verifier", None)
            request.session.pop("state", None)
            # Login the user and record his device info
            user_login(request=request, user=user, is_app=True)
            # Get the redirection path
            path = next_path if next_path else get_redirection_path(user=user)
            url = get_safe_redirect_url(base_url=base_host(request=request, is_app=True), next_path=path, params={})
            return HttpResponseRedirect(url)
        except AuthenticationException as e:
            params = e.get_error_dict()
            url = get_safe_redirect_url(
                base_url=base_host(request=request, is_app=True), next_path=next_path, params=params
            )
            return HttpResponseRedirect(url)
