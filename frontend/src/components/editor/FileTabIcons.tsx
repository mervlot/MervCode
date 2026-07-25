import { useState } from "react";
import { Settings } from "lucide-react";
import iconRegistry from "../../vars/icon.json";

const fileNames = (iconRegistry as any).fileNames || {};
const fileExtensions = (iconRegistry as any).fileExtensions || {};
const iconDefinitions = (iconRegistry as any).iconDefinitions || {};
const defaultFile = (iconRegistry as any).file || "file";

function SafeIcon({ src, className }: { src: string; className: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <img src='/icons/file.svg' className={className} alt='' />;
  }

  return (
    <img
      src={src}
      className={className}
      alt=''
      onError={() => setFailed(true)}
      loading='lazy'
      draggable={false}
    />
  );
}

export function FileTabIcon({ name }: { name: string }) {
  if (name === "Settings") {
    return <Settings size={14} className='shrink-0 text-tertiary' />;
  }

  const normalizedName = name.toLowerCase();
  const ext = name.split(".").pop()?.toLowerCase();

  let iconName: string | undefined =
    fileNames[normalizedName] || fileNames[name];

  if (!iconName && ext) {
    iconName = fileExtensions[ext];
  }

  if (!iconName) {
    iconName = defaultFile;
  }

  const iconDef = iconDefinitions[iconName || ""];
  const iconSrc = iconDef?.iconPath
    ? `/icons/${iconDef.iconPath.split("/").pop()}`
    : "/icons/file.svg";

  return <SafeIcon src={iconSrc} className='h-3.5 w-3.5 shrink-0' />;
}
