import { SettingsIcon } from "@solar-icons/react/linear/settings";
import { AddIcon } from "@solar-icons/react/linear/add";
import { MinusIcon } from "@solar-icons/react/linear/minus";
import { CloseIcon } from "@solar-icons/react/linear/close";
import { AltArrowDownIcon } from "@solar-icons/react/linear/alt-arrow-down";
import { AltArrowLeftIcon } from "@solar-icons/react/linear/alt-arrow-left";
import { AltArrowRightIcon } from "@solar-icons/react/linear/alt-arrow-right";
import { TrashBinTrashIcon } from "@solar-icons/react/linear/trash-bin-trash";
import { MagnifierIcon } from "@solar-icons/react/linear/magnifier";
import { ListIcon } from "@solar-icons/react/linear/list";
import { CalendarMinimalisticIcon } from "@solar-icons/react/linear/calendar-minimalistic";
import { UserPlusIcon } from "@solar-icons/react/linear/user-plus";
import { CameraMinimalisticIcon } from "@solar-icons/react/linear/camera-minimalistic";
import { VolumeSmallIcon } from "@solar-icons/react/linear/volume-small";
import { CopyIcon } from "@solar-icons/react/linear/copy";
import { EyeClosedIcon } from "@solar-icons/react/linear/eye-closed";
import { LinkMinimalisticIcon } from "@solar-icons/react/linear/link-minimalistic";
import { PenIcon } from "@solar-icons/react/linear/pen";
import { DownloadMinimalisticIcon } from "@solar-icons/react/linear/download-minimalistic";
import { UploadMinimalisticIcon } from "@solar-icons/react/linear/upload-minimalistic";

type Props = { size?: number };

export function IconSettings({ size = 18 }: Props) {
  return <SettingsIcon size={size} color="currentColor" />;
}

export function IconPlus({ size = 18 }: Props) {
  return <AddIcon size={size} color="currentColor" />;
}

export function IconMinus({ size = 18 }: Props) {
  return <MinusIcon size={size} color="currentColor" />;
}

export function IconClose({ size = 16 }: Props) {
  return <CloseIcon size={size} color="currentColor" />;
}

export function IconChevron({ size = 14 }: Props) {
  return <AltArrowDownIcon size={size} color="currentColor" />;
}

export function IconChevronLeft({ size = 16 }: Props) {
  return <AltArrowLeftIcon size={size} color="currentColor" />;
}

export function IconChevronRight({ size = 16 }: Props) {
  return <AltArrowRightIcon size={size} color="currentColor" />;
}

export function IconTrash({ size = 15 }: Props) {
  return <TrashBinTrashIcon size={size} color="currentColor" />;
}

export function IconSearch({ size = 15 }: Props) {
  return <MagnifierIcon size={size} color="currentColor" />;
}

export function IconList({ size = 16 }: Props) {
  return <ListIcon size={size} color="currentColor" />;
}

export function IconCalendar({ size = 16 }: Props) {
  return <CalendarMinimalisticIcon size={size} color="currentColor" />;
}

export function IconUserPlus({ size = 16 }: Props) {
  return <UserPlusIcon size={size} color="currentColor" />;
}

export function IconCamera({ size = 15 }: Props) {
  return <CameraMinimalisticIcon size={size} color="currentColor" />;
}

export function IconSound({ size = 15 }: Props) {
  return <VolumeSmallIcon size={size} color="currentColor" />;
}

export function IconCopy({ size = 15 }: Props) {
  return <CopyIcon size={size} color="currentColor" />;
}

export function IconHide({ size = 15 }: Props) {
  return <EyeClosedIcon size={size} color="currentColor" />;
}

export function IconLink({ size = 15 }: Props) {
  return <LinkMinimalisticIcon size={size} color="currentColor" />;
}

export function IconEdit({ size = 15 }: Props) {
  return <PenIcon size={size} color="currentColor" />;
}

export function IconDownload({ size = 15 }: Props) {
  return <DownloadMinimalisticIcon size={size} color="currentColor" />;
}

export function IconUpload({ size = 15 }: Props) {
  return <UploadMinimalisticIcon size={size} color="currentColor" />;
}
