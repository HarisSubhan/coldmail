export function assertMonitoringRole(isSuperAdmin, lookupFailed) {
  if (lookupFailed || isSuperAdmin !== true)
    throw new Error("Forbidden");
}
