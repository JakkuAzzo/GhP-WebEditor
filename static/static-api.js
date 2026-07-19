(function installStaticLocalMode(global) {
    'use strict';

    // GitHub Pages project paths share one origin. This edition must therefore
    // never hold a bearer token or proxy privileged GitHub API requests.
    global.GhpStaticApi = Object.freeze({ localOnly: true });

    global.addEventListener('DOMContentLoaded', () => {
        document.documentElement.dataset.runtime = 'github-pages';
        const credentials = document.getElementById('staticGithubCredentials');
        const serverDescription = document.getElementById('serverGithubDescription');
        if (credentials) credentials.hidden = false;
        if (serverDescription) serverDescription.hidden = true;
        const tagline = document.querySelector('.tagline');
        if (tagline) tagline.textContent = 'Static GitHub Pages edition · local editing and ZIP export';
        const welcome = document.querySelector('.welcome-content > p');
        if (welcome) welcome.textContent = 'Edit locally, import a ZIP, and export a finished site. Secure GitHub publishing is available in the desktop or server edition.';
        const connectButton = document.getElementById('connectGithubSubmit');
        if (connectButton) connectButton.textContent = 'Use desktop or server edition';
        const cloneButton = document.getElementById('openCloneModalBtn');
        if (cloneButton) {
            cloneButton.disabled = true;
            cloneButton.title = 'Repository access requires the desktop or server edition.';
        }
    });
}(window));
