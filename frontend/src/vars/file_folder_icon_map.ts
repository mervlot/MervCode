import JSIcon from "../assets/icons/javascript.svg";
import TSIcon from "../assets/icons/typescript.svg";
import ReactIcon from "../assets/icons/react.svg";
import JSONIcon from "../assets/icons/json.svg";
import MarkdownIcon from "../assets/icons/markdown.svg";
import HTMLIcon from "../assets/icons/html.svg";
import CSSIcon from "../assets/icons/css.svg";
import PythonIcon from "../assets/icons/python.svg";
import GoIcon from "../assets/icons/go.svg";
import RustIcon from "../assets/icons/rust.svg";
import PHPIcon from "../assets/icons/php.svg";
import ExeIcon from "../assets/icons/exe.svg";
import FileIcon from "../assets/icons/file.svg";
import FolderIcon from "../assets/icons/folder.svg";
import FolderOpenIcon from "../assets/icons/folder-open.svg";
import GitIcon from "../assets/icons/git.svg";
import GitHubFolderIcon from "../assets/icons/folder-github.svg";
import GitHubFolderOpenIcon from "../assets/icons/folder-github-open.svg";
import GitLabIcon from "../assets/icons/gitlab.svg";
import BitbucketIcon from "../assets/icons/bitbucket.svg";
import GitPodIcon from "../assets/icons/gitpod.svg";
import ImageIcon from "../assets/icons/image.svg";
import GitFolderIcon from "../assets/icons/folder-git.svg";
import GitFolderOpenIcon from "../assets/icons/folder-git-open.svg";
import AndroidFolderIcon from "../assets/icons/folder-android.svg";
import AndroidFolderOpenIcon from "../assets/icons/folder-android-open.svg";
import clientFolderIcon from "../assets/icons/folder-client.svg";
import clientFolderOpenIcon from "../assets/icons/folder-client-open.svg";
const fileIconMap = {
  js: JSIcon,
  jsx: ReactIcon,
  ts: TSIcon,
  tsx: ReactIcon,
  json: JSONIcon,
  md: MarkdownIcon,
  html: HTMLIcon,
  css: CSSIcon,
  py: PythonIcon,
  go: GoIcon,
  rs: RustIcon,
  php: PHPIcon,
  png: FileIcon,
  jpg: FileIcon,
  svg: FileIcon,
  txt: FileIcon,
  exe: ExeIcon,
  gitignore: GitIcon,

} as const;
const folderIconMap = {
  ".git": {
    closed: GitFolderIcon,
    open: GitFolderOpenIcon,
  },
  git: {
    closed: GitFolderIcon,
    open: GitFolderOpenIcon,
  },
  ".github": {
    closed: GitHubFolderIcon,
    open: GitHubFolderOpenIcon,
  },
  ".gitlab": {
    closed: GitLabIcon,
    open: GitLabIcon,
  },
  gitlab: {
    closed: GitLabIcon,
    open: GitLabIcon,
  },
  images: {
    closed: ImageIcon,
    open: ImageIcon,
  },
  assets: {
    closed: ImageIcon,
    open: ImageIcon,
  },
  "android": {
    closed: AndroidFolderIcon,
    open: AndroidFolderOpenIcon,
  },
  "client": {
    closed: clientFolderIcon,
    open: clientFolderOpenIcon,
  },
  "frontend": {
    closed: clientFolderIcon,
    open: clientFolderOpenIcon,
  }
  
} as const;

export { fileIconMap, folderIconMap };
