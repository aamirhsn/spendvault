import type { SVGProps } from 'react';

const base = (d: React.ReactNode) =>
  function Icon(p: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
        {d}
      </svg>
    );
  };

export const IHome = base(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></>);
export const IReceipt = base(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>);
export const IScan = base(<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M8 8h3v3H8zM13 13h3v3h-3zM13 8h3M8 16h3M16 11v-1" /></>);
export const IGift = base(<><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5zM12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5z" /></>);
export const ICard = base(<><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6 15h4" /></>);
export const IPlus = base(<path d="M12 5v14M5 12h14" />);
export const IClose = base(<path d="M6 6l12 12M18 6 6 18" />);
export const IBack = base(<path d="M15 5l-7 7 7 7" />);
export const IChevron = base(<path d="M9 5l7 7-7 7" />);
export const ISettings = base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const ILock = base(<><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IFace = base(<><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M9 9v1.5M15 9v1.5M12 9v4h-1M9.5 16s1 1 2.5 1 2.5-1 2.5-1" /></>);
export const IFinger = base(<><path d="M12 11v3a8 8 0 0 1-1.5 4.7" /><path d="M8.5 7.5A5 5 0 0 1 17 11v2a12 12 0 0 1-.6 3.8" /><path d="M5.5 10.5A7 7 0 0 1 12 4a7 7 0 0 1 7 7v1M6 14.5v-3.5M8.5 11v2.5a10 10 0 0 1-1.6 5.4M14.5 11v3a10 10 0 0 1-1 4.5" /></>);
export const IEye = base(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
export const IEyeOff = base(<><path d="M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>);
export const ICopy = base(<><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>);
export const ITrash = base(<><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3" /></>);
export const IEdit = base(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>);
export const ISearch = base(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const IImage = base(<><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>);
export const IStore = base(<><path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M9 20v-5h6v5" /></>);
export const ICalendar = base(<><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>);
export const IWallet = base(<><path d="M3 7a2 2 0 0 1 2-2h13v4" /><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2z" /><circle cx="16" cy="14.5" r="1.2" fill="currentColor" /></>);
export const IAlert = base(<><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17v.5" /></>);
export const ICheck = base(<path d="M5 12.5l4.5 4.5L19 7.5" />);
export const IDownload = base(<><path d="M12 3v12M7 10l5 5 5-5M4 19h16" /></>);
export const IUpload = base(<><path d="M12 15V3M7 8l5-5 5 5M4 19h16" /></>);
export const ISun = base(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const ITimer = base(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>);
export const IKey = base(<><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3M17 6l3 3M14 9l2 2" /></>);
export const IBolt = base(<path d="M13 2 4 14h7l-1 8 9-12h-7z" />);
export const IFlash = base(<><path d="M7 2h10l-2 7h4L9 22l2-9H7z" /></>);
export const IUser = base(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const IBudget = base(<><circle cx="12" cy="12" r="9" /><path d="M12 3v9l6.4 6.4" /></>);

export const IEllipsis = base(<><circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" /></>);
export const IPie = base(<><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>);
export const ITrend = base(<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>);
export const IFlame = base(<path d="M12 21c-3.9 0-7-2.7-7-6.5 0-3.8 3-5.7 4-9.5 1.5 1.6 2.3 3.2 2.5 4.8C13 8.5 14 7 14.3 5c2.6 2.2 4.7 5.6 4.7 9.5 0 3.8-3.1 6.5-7 6.5z" />);
export const IBell = base(<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>);
export const IShield = base(<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>);
export const IArrowDown = base(<><path d="M12 5v14M6 13l6 6 6-6" /></>);
export const ITag = base(<><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.5" /></>);
export const INote = base(<><path d="M5 4h14v16H5z" /><path d="M9 9h6M9 13h6M9 17h3" /></>);
export const IUsers = base(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>);
export const IHash = base(<path d="M9 3 7 21M17 3l-2 18M4 8.5h16M3 15.5h16" />);
