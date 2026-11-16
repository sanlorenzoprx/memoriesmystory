import { createContext, useContext } from "react";
import { familyApi, type FamilyApi } from "../../services/family-archive";

/** Which actor the album panel acts for: the owner by default, or a permitted relative. */
export const FamilyApiContext = createContext<FamilyApi>(familyApi());
export const useFamilyApi = () => useContext(FamilyApiContext);
