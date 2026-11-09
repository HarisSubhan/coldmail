class Query {
  constructor(exec, table) {
    this.exec = exec;
    this.spec = { table, op: "select", filters: [], order: [] };
  }
  spec;
  select(columns = "*", opts) {
    if (this.spec.op === "select") this.spec.columns = columns;
    else this.spec.returning = true;
    if (opts?.count) this.spec.count = true;
    if (opts?.head) this.spec.head = true;
    return this;
  }
  insert(values) {
    this.spec.op = "insert";
    this.spec.values = values;
    return this;
  }
  update(values) {
    this.spec.op = "update";
    this.spec.values = values;
    return this;
  }
  upsert(values, opts) {
    this.spec.op = "upsert";
    this.spec.values = values;
    this.spec.onConflict = opts?.onConflict;
    return this;
  }
  delete() {
    this.spec.op = "delete";
    return this;
  }
  f(col, op, v) {
    this.spec.filters.push([col, op, v]);
    return this;
  }
  eq(c, v) {
    return this.f(c, "eq", v);
  }
  neq(c, v) {
    return this.f(c, "neq", v);
  }
  in(c, v) {
    return this.f(c, "in", v);
  }
  lt(c, v) {
    return this.f(c, "lt", v);
  }
  gt(c, v) {
    return this.f(c, "gt", v);
  }
  lte(c, v) {
    return this.f(c, "lte", v);
  }
  gte(c, v) {
    return this.f(c, "gte", v);
  }
  or(expr) {
    return this.f("", "or", expr);
  }
  order(col, opts) {
    this.spec.order.push([col, opts?.ascending ?? true]);
    return this;
  }
  limit(n) {
    this.spec.limit = n;
    return this;
  }
  single() {
    this.spec.single = "single";
    return this;
  }
  maybeSingle() {
    this.spec.single = "maybe";
    return this;
  }
  then(ok, bad) {
    return this.exec(this.spec).then(ok, bad);
  }
}
export {
  Query
};
