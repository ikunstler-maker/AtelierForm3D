import React from 'react';
import { MeasurementCategory } from '../../data/measurementsSchema';

export interface IconProps {
  className?: string;
  size?: number;
}

export const IconAtelierBrand: React.FC<IconProps> = ({ className = '', size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2.5c1.8 0 3.2 1.2 3.2 2.8 0 1.4-1 2.4-2.2 2.7l3.8 2.2c.9.5 1.3 1.5 1 2.5L15.5 19c-.3 1-1.3 1.7-2.4 1.7h-2.2c-1.1 0-2.1-.7-2.4-1.7L6.2 12.7c-.3-1 .1-2 1-2.5L11 8c-1.2-.3-2.2-1.3-2.2-2.7 0-1.6 1.4-2.8 3.2-2.8Z" />
    <path d="M7.5 14.5c2.8 1.2 6.2 1.2 9 0" />
    <path d="M12 8v12.7" />
    <path d="M9 21.5h6" />
  </svg>
);

export const IconGenderFemale: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="8.5" r="5" />
    <path d="M12 13.5v7.5" />
    <path d="M9 18h6" />
  </svg>
);

export const IconGenderMale: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="10" cy="14" r="5" />
    <path d="M13.6 10.4 19 5" />
    <path d="M14.5 5H19v4.5" />
  </svg>
);

export const IconEyeOpen: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M2.2 12c1.9-4.2 5.7-7 9.8-7s7.9 2.8 9.8 7c-1.9 4.2-5.7 7-9.8 7s-7.9-2.8-9.8-7Z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);

export const IconEyeClosed: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 3l18 18" />
    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
    <path d="M9.4 5.4A9.8 9.8 0 0 1 12 5c4.1 0 7.9 2.8 9.8 7a11.7 11.7 0 0 1-3.1 4.2" />
    <path d="M6.3 6.3C4.4 7.7 3 9.7 2.2 12c1.9 4.2 5.7 7 9.8 7 1.8 0 3.5-.5 5-1.4" />
  </svg>
);

export const IconSearch: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

export const IconExportJson: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 3v12" />
    <path d="m8 11 4 4 4-4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const IconImportJson: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 15V3" />
    <path d="m8 7 4-4 4 4" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const IconFitVerify: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M8.5 3.5 12 6l3.5-2.5 4.5 3-2 4.5-2-1v9.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10l-2 1-2-4.5 4.5-3Z" />
    <path d="m9.5 13.5 1.8 1.8 3.5-3.5" />
  </svg>
);

export const IconGlassSliders: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h16" />
    <circle cx="9" cy="6" r="2.2" fill="currentColor" />
    <circle cx="15" cy="12" r="2.2" fill="currentColor" />
    <circle cx="10" cy="18" r="2.2" fill="currentColor" />
  </svg>
);

export const IconReset: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export const IconChevronLeft: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const IconChevronRight: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const IconClose: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export const IconCameraFull: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="4.5" r="2" />
    <path d="M8.5 8.5h7l-1 5.5v6.5h-5V14l-1-5.5Z" />
    <path d="M4 4h3M17 4h3M4 20h3M17 20h3" />
  </svg>
);

export const IconCameraTorso: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M7.5 4.5 12 6l4.5-1.5 2.5 3.5-2.5 2v9.5h-9V10L5 8l2.5-3.5Z" />
    <ellipse cx="12" cy="13.5" rx="4.5" ry="1.8" />
  </svg>
);

export const IconCameraSleeves: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 5.5h5l6.5 9.5-3 2L9 9.5V19H6V5.5Z" />
    <path d="m14.5 17 3 3" />
  </svg>
);

export const IconCameraLegs: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M7.5 3.5h9l1 7.5-1 9.5h-3l-.8-9.5h-1.4L10.5 20.5h-3l-1-9.5 1-7.5Z" />
    <path d="M7.5 7.5h9" />
  </svg>
);

export const IconCameraBack: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M7 5.5h10l-1.5 7.5 1 6.5h-9l1-6.5L7 5.5Z" />
    <path d="M12 5.5v14" />
    <path d="M9.2 9.5 12 11l2.8-1.5" />
  </svg>
);

export const IconTargetFocus: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.2" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

export const IconThemeSun: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
  </svg>
);

export const IconThemeMoon: React.FC<IconProps> = ({ className = '', size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
  </svg>
);

export const IconCategory: React.FC<{
  category: MeasurementCategory;
  className?: string;
  size?: number;
}> = ({ category, className = '', size = 15 }) => {
  switch (category) {
    case 'circumferences':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <ellipse cx="12" cy="12" rx="8.5" ry="4.5" />
          <path d="M16.5 9.5 19.5 12l-3 2.5" />
        </svg>
      );
    case 'torso':
      return <IconCameraTorso className={className} size={size} />;
    case 'sleeves':
      return <IconCameraSleeves className={className} size={size} />;
    case 'legs':
      return <IconCameraLegs className={className} size={size} />;
    case 'heights':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M12 3v18" />
          <path d="m8.5 6.5 3.5-3.5 3.5 3.5" />
          <path d="m8.5 17.5 3.5 3.5 3.5-3.5" />
          <path d="M6 3h12M6 21h12" />
        </svg>
      );
    case 'extremities':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M8 13V5.5a1.2 1.2 0 0 1 2.4 0V11" />
          <path d="M10.4 11V4.2a1.2 1.2 0 0 1 2.4 0V11" />
          <path d="M12.8 11V5.2a1.2 1.2 0 0 1 2.4 0V12" />
          <path d="M15.2 12V7.5a1.2 1.2 0 0 1 2.4 0v7.5a5.5 5.5 0 0 1-5.5 5.5h-1.2a5 5 0 0 1-4.5-2.8l-1.9-3.8a1.3 1.3 0 0 1 2.2-1.3L8 14.5" />
        </svg>
      );
  }
};
