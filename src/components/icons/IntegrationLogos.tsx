import type { ReactNode } from "react";

interface LogoProps {
  size?: number;
}

function GoogleCalendarLogo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#4285F4" d="M36 8H12a4 4 0 0 0-4 4v24a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V12a4 4 0 0 0-4-4z" />
      <path fill="#fff" d="M12 16h24v20H12z" />
      <path fill="#EA4335" d="M36 8v4H12V8h24z" />
      <rect fill="#4285F4" x="14" y="20" width="4" height="4" rx="0.5" />
      <rect fill="#4285F4" x="22" y="20" width="4" height="4" rx="0.5" />
      <rect fill="#4285F4" x="30" y="20" width="4" height="4" rx="0.5" />
      <rect fill="#4285F4" x="14" y="28" width="4" height="4" rx="0.5" />
      <rect fill="#4285F4" x="22" y="28" width="4" height="4" rx="0.5" />
      <rect fill="#FBBC04" x="30" y="28" width="4" height="4" rx="0.5" />
    </svg>
  );
}

function OutlookCalendarLogo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#0078D4" d="M40 8H20a2 2 0 0 0-2 2v4h18a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H18v2a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2z" />
      <path fill="#0078D4" d="M36 16H18v20h18a2 2 0 0 0 2-2V18a2 2 0 0 0-2-2z" opacity="0.6" />
      <rect fill="#fff" x="22" y="20" width="4" height="3" rx="0.3" />
      <rect fill="#fff" x="28" y="20" width="4" height="3" rx="0.3" />
      <rect fill="#fff" x="34" y="20" width="4" height="3" rx="0.3" />
      <rect fill="#fff" x="22" y="25" width="4" height="3" rx="0.3" />
      <rect fill="#fff" x="28" y="25" width="4" height="3" rx="0.3" />
      <rect fill="#fff" x="34" y="25" width="4" height="3" rx="0.3" />
      <rect fill="#fff" x="22" y="30" width="4" height="3" rx="0.3" />
      <rect fill="#fff" x="28" y="30" width="4" height="3" rx="0.3" />
      <path fill="#0364B8" d="M24 7 6 12v24l18 5V7z" rx="1" />
      <ellipse fill="#fff" cx="15" cy="24" rx="5.5" ry="6" />
      <ellipse fill="#0364B8" cx="15" cy="24" rx="3.5" ry="4" />
    </svg>
  );
}

function GmailLogo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#4285F4" d="M6 12a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V12z" />
      <path fill="#EA4335" d="M6 12l18 14L42 12v-2a4 4 0 0 0-4-4H10a4 4 0 0 0-4 4v2z" />
      <path fill="#FBBC04" d="M6 12v24a4 4 0 0 0 4 4h2V16L6 12z" />
      <path fill="#34A853" d="M42 12v24a4 4 0 0 1-4 4h-2V16l6-4z" />
      <path fill="#C5221F" d="M12 40V16l12 10 12-10v24H12z" opacity="0" />
      <path fill="#fff" d="M12 16l12 10 12-10v22H12V16z" opacity="0.95" />
      <path fill="#EA4335" d="M12 16l12 10 12-10" strokeWidth="0" />
    </svg>
  );
}

function OutlookMailLogo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#0078D4" d="M40 10H20a2 2 0 0 0-2 2v2l14 8 10-6V12a2 2 0 0 0-2-2z" />
      <path fill="#0078D4" d="M18 14v22a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V20l-10 6-14-8v-4z" opacity="0.7" />
      <path fill="#28A8EA" d="M42 14v6l-10 6-14-8v-4h22a2 2 0 0 1 2 2v-2z" opacity="0.5" />
      <path fill="#0364B8" d="M24 7 6 12v24l18 5V7z" />
      <ellipse fill="#fff" cx="15" cy="24" rx="5.5" ry="6" />
      <ellipse fill="#0364B8" cx="15" cy="24" rx="3.5" ry="4" />
    </svg>
  );
}

function HubSpotLogo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <circle fill="#FF7A59" cx="30" cy="22" r="4" />
      <path fill="#FF7A59" d="M30 14V10h-2v4a6 6 0 0 0-4.2 1.8l-7.4-4.6-.8 1.4 7.2 4.5A6 6 0 0 0 24 22a6 6 0 0 0 .8 4.9l-7.2 4.5.8 1.4 7.4-4.6A6 6 0 0 0 30 30a6 6 0 0 0 6-6 6 6 0 0 0-6-6v-4zm0 14a6 6 0 1 1 0-12 6 6 0 0 1 0 12z" opacity="0" />
      <path fill="#FF7A59" d="M30 16a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
      <rect fill="#FF7A59" x="29" y="9" width="2" height="7" rx="1" />
      <circle fill="#FF7A59" cx="14" cy="33" r="2.5" />
      <path d="M16.2 31.3 23 27" stroke="#FF7A59" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M23 17l-6.8 4.3" stroke="#FF7A59" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle fill="#FF7A59" cx="14" cy="12" r="2.5" />
    </svg>
  );
}

function SalesforceLogo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#00A1E0" d="M20.2 11.5a8.2 8.2 0 0 1 6.6-3.3c3.2 0 6 1.8 7.4 4.5a9.3 9.3 0 0 1 3.3-.6c5.2 0 9.4 4.2 9.4 9.4 0 5.2-4.2 9.4-9.4 9.4-.7 0-1.4-.1-2-.2a7.5 7.5 0 0 1-6.7 4.1 7.5 7.5 0 0 1-4.3-1.4 8.8 8.8 0 0 1-7.3 3.9 8.8 8.8 0 0 1-8.4-6.2 7.4 7.4 0 0 1-2-.3C3 30.3.1 27 .1 23c0-4.3 3.5-7.9 7.9-7.9.9 0 1.7.2 2.5.4a8.2 8.2 0 0 1 9.7-4z" />
    </svg>
  );
}

function SlackLogo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#E01E5A" d="M13 28a3 3 0 1 1-3-3h3v3zm1.5 0a3 3 0 1 1 6 0v7.5a3 3 0 1 1-6 0V28z" />
      <path fill="#36C5F0" d="M20 13a3 3 0 1 1 3-3v3h-3zm0 1.5a3 3 0 1 1 0 6h-7.5a3 3 0 1 1 0-6H20z" />
      <path fill="#2EB67D" d="M35 20a3 3 0 1 1 3 3h-3v-3zm-1.5 0a3 3 0 1 1-6 0v-7.5a3 3 0 1 1 6 0V20z" />
      <path fill="#ECB22E" d="M28 35a3 3 0 1 1-3 3v-3h3zm0-1.5a3 3 0 1 1 0-6h7.5a3 3 0 1 1 0 6H28z" />
    </svg>
  );
}

function NotionLogo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="currentColor" fillRule="evenodd" d="M8.4 6.7c1.5 1.2 2 1.1 4.8.9l26 -1.5c.5 0 .1-0.5-.1-.6l-4.3-3.1c-.8-.6-1.9-1.3-3.9-1.1l-25.2 1.8c-.9.1-1.1.5-.7.9l3.4 2.6zM10 12.5v27.3c0 1.5.7 2 2.4 1.9l28.6-1.6c1.6-.1 1.8-1.1 1.8-2.2V11.1c0-1.1-.4-1.7-1.4-1.6L12.2 11.2c-1.1.1-1.6.6-1.6 1.7l-.6-.4zm28.3 1.3c.2.8 0 1.5-.8 1.6l-1.4.3v20.2c-1.2.6-2.3.9-3.2.9-1.5 0-1.9-.5-3-1.9L21 22.1v12.4l2.8.6s0 1.5-2.2 1.5l-5.9.4c-.2-.4 0-1.3.6-1.5l1.6-.4V17.6l-2.2-.2c-.2-.8.3-2 1.5-2.1l6.4-.4 9.3 14.2V18l-2.4-.3c-.2-1 .5-1.6 1.4-1.7l6.1-.3z" />
    </svg>
  );
}

function GoogleDriveLogo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M30.6 42H17.4l6.6-11.4L30.6 42z" />
      <path fill="#1E88E5" d="M17.4 42l-6.6-11.4L24 7.2l6.6 11.4L17.4 42z" opacity="0" />
      <path fill="#4CAF50" d="M24 7.2l6.6 11.4H44L37.4 7.2H24z" />
      <path fill="#1E88E5" d="M10.8 30.6l6.6 11.4L4 30.6h6.8z" />
      <path fill="#1E88E5" d="M4 30.6h13.4L24 18.6 17.4 7.2 4 30.6z" />
      <path fill="#FFC107" d="M30.6 18.6H44l-6.6 12H24l6.6-12z" />
      <path fill="#E65100" d="M17.4 42l6.6-11.4h13.4L30.6 42H17.4z" opacity="0.2" />
      <path fill="#1565C0" d="M4 30.6L17.4 7.2 24 18.6 10.6 30.6H4z" opacity="0.2" />
      <path fill="#1B5E20" d="M37.4 7.2L44 18.6H30.6L24 7.2h13.4z" opacity="0.2" />
    </svg>
  );
}

function LinearLogo({ size = 28 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#5E6AD2" d="M5.6 27.4a21.7 21.7 0 0 0 15 15l17.8-17.8a21.7 21.7 0 0 0-15-15L5.6 27.4zm3.1-5.5a21.7 21.7 0 0 1 17.4-13l-4.6 4.6a17.2 17.2 0 0 0-9.6 5.3L8.7 21.9zm22.2 18.8a21.7 21.7 0 0 0 13-17.4l-3.1 3.1a17.2 17.2 0 0 1-5.3 9.6l-4.6 4.7zM6 24c0-.7 0-1.4.1-2.1L24.1 3.9C24.1 3.9 24 4 24 4a20 20 0 1 0 20 20c0 0 0-.1 0-.1L25.9 42A20 20 0 0 1 6 24z" />
    </svg>
  );
}

export const integrationLogos: Record<string, (props: LogoProps) => ReactNode> = {
  "google-calendar": GoogleCalendarLogo,
  "outlook-calendar": OutlookCalendarLogo,
  "gmail": GmailLogo,
  "outlook-mail": OutlookMailLogo,
  "hubspot": HubSpotLogo,
  "salesforce": SalesforceLogo,
  "slack": SlackLogo,
  "notion": NotionLogo,
  "google-drive": GoogleDriveLogo,
  "linear": LinearLogo,
};
