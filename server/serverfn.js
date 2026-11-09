const requireAuth = "auth";
function createServerFn(_opts) {
  const def = {
    auth: false,
    validate: (d) => d
  };
  const builder = {
    middleware(_m) {
      def.auth = true;
      return builder;
    },
    inputValidator(v) {
      def.validate = v;
      return builder;
    },
    handler(fn) {
      return { ...def, fn, __serverFn: true };
    }
  };
  return builder;
}
export {
  createServerFn,
  requireAuth
};
