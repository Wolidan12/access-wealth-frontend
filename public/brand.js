/* Replaces legacy text/crown Access Wealth marks with the shared image logo. */
(function () {
    const logoSource = '/access-wealth-logo.png';

    function imageLogo() {
        const image = document.createElement('img');
        image.className = 'aw-brand-logo';
        image.src = logoSource;
        image.alt = 'Access Wealth — Access today. Wealth tomorrow.';
        image.decoding = 'async';
        return image;
    }

    function replaceBrand(element) {
        if (!element || element.dataset.brandImage === 'true') return;
        element.dataset.brandImage = 'true';
        element.classList.add('aw-image-brand');
        element.replaceChildren(imageLogo());
    }

    function applyBranding() {
        document.querySelectorAll('.logo-area, .logo-text, .logo').forEach((element) => {
            if (/access\s*wealth/i.test(element.textContent)) replaceBrand(element);
        });
        document.querySelectorAll('.auth-brand').forEach(replaceBrand);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyBranding);
    else applyBranding();
})();
