import { GenericClassRoleFinder } from "../../generic/GenericClassRoleFinder.mjs";

export class JvmJakartaClassRoleFinder extends GenericClassRoleFinder {
  family = "jvm";
  framework = "jakarta";
  entryBoundaryMarks = /^\s*@(Path|WebServlet|ServerEndpoint)\b/;
  typeMapping = /^\s*@Path\b/;
}
