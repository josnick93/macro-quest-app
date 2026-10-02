/** ¿Se ha escaneado algún código en este dispositivo? Preferencia local (`mq:*`): solo sirve para el logro. */
const KEY = "mq:scanned";

export const hasScanned = (): boolean => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export const markScanned = (): void => {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* sin almacenamiento: el logro tendrá que esperar */
  }
};
