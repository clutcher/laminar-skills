import { FolderChildren } from "../slices/FolderChildren.mjs";

const joinChildPath = (folder, name) => (folder ? `${folder}/${name}` : name);

export class ShapeFolderChildren extends FolderChildren {
  readRepositoryFileList(folder) {
    return this.treeShownByTheChange.listChildren(folder).map(child => joinChildPath(folder, child.name));
  }
}
