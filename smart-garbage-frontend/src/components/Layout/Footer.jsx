// src/components/Layout/Footer.jsx
//
// Optional configuration (set in .env / build environment; nothing is shown when unset):
//   REACT_APP_SUPPORT_EMAIL     support e-mail address, rendered as a mailto: link
//   REACT_APP_SUPPORT_PHONE     support phone number, rendered as a tel: link
//   REACT_APP_SOCIAL_FACEBOOK   full URL of the Facebook page
//   REACT_APP_SOCIAL_TWITTER    full URL of the Twitter/X profile
//   REACT_APP_SOCIAL_INSTAGRAM  full URL of the Instagram profile
//   REACT_APP_SOCIAL_LINKEDIN   full URL of the LinkedIn page
import React from 'react';
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n/LanguageContext';
import './Footer.css';

function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const email = (process.env.REACT_APP_SUPPORT_EMAIL || '').trim();
  const phone = (process.env.REACT_APP_SUPPORT_PHONE || '').trim();
  const socials = [
    { key: 'facebook', label: 'Facebook', icon: 'fa-facebook-f', url: process.env.REACT_APP_SOCIAL_FACEBOOK },
    { key: 'twitter', label: 'Twitter', icon: 'fa-twitter', url: process.env.REACT_APP_SOCIAL_TWITTER },
    { key: 'instagram', label: 'Instagram', icon: 'fa-instagram', url: process.env.REACT_APP_SOCIAL_INSTAGRAM },
    { key: 'linkedin', label: 'LinkedIn', icon: 'fa-linkedin-in', url: process.env.REACT_APP_SOCIAL_LINKEDIN },
  ]
    .map((s) => ({ ...s, url: (s.url || '').trim() }))
    .filter((s) => s.url);

  return (
    <footer className="footer app-footer mt-auto py-3">
      <Container>
        <div className="footer-row">
          <p className="footer-desc mb-0">
            <i className="fas fa-recycle me-2" aria-hidden="true"></i>
            {t('footer.description')}
          </p>
          <nav aria-label={t('footer.navLabel')} className="footer-links">
            <Link to="/">{t('footer.home')}</Link>
            {email && (
              <a href={`mailto:${email}`}>
                <i className="fas fa-envelope me-1" aria-hidden="true"></i>
                {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
                <i className="fas fa-phone me-1" aria-hidden="true"></i>
                {phone}
              </a>
            )}
            {socials.map((s) => (
              <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}>
                <i className={`fab ${s.icon}`} aria-hidden="true"></i>
              </a>
            ))}
          </nav>
        </div>
        <p className="footer-copy small mb-0">{t('footer.copyright', { year: currentYear })}</p>
      </Container>
    </footer>
  );
}

export default Footer;
