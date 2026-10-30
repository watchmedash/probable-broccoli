import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import {
  faArrowUp, faArrowDown, faMagnifyingGlass, faPlus, faBell, faShare, faEllipsis, faFlag, faLock, faThumbtack,
  faArrowLeft, faImage, faXmark, faCheck, faRightFromBracket, faGear, faUser, faUsers, faHouse, faFire,
  faChartLine, faEye, faEyeSlash, faTrash, faPen, faReply, faCopy, faKey, faUserPlus, faUserCheck, faEnvelope,
} from "@fortawesome/free-solid-svg-icons";
import { faComment, faBookmark, faImage as faImageOutline } from "@fortawesome/free-regular-svg-icons";

// The same Font Awesome set the Android app uses.
export const I = {
  up: faArrowUp, down: faArrowDown, search: faMagnifyingGlass, plus: faPlus, bell: faBell, share: faShare,
  more: faEllipsis, flag: faFlag, lock: faLock, pin: faThumbtack, back: faArrowLeft, image: faImage,
  imageOutline: faImageOutline, close: faXmark, check: faCheck, logout: faRightFromBracket, settings: faGear,
  user: faUser, users: faUsers, home: faHouse, hot: faFire, popular: faChartLine, eye: faEye, eyeOff: faEyeSlash,
  trash: faTrash, edit: faPen, reply: faReply, copy: faCopy, key: faKey, follow: faUserPlus, following: faUserCheck,
  mail: faEnvelope, comment: faComment, save: faBookmark,
} satisfies Record<string, IconDefinition>;

export function Icon({ icon, size = 16, className, label }: { icon: IconDefinition; size?: number; className?: string; label?: string }) {
  const [w, h, , , path] = icon.icon;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size}
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      fill="currentColor"
    >
      {(Array.isArray(path) ? path : [path]).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
