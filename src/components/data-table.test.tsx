import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { DataTable, type DataTableColumn } from "./data-table";

interface Row { id: string; title: string }
const columns: DataTableColumn<Row>[] = [
  { id: "title", header: "Título", accessorFn: (r) => r.title, cell: (r) => r.title, sortable: true },
];
const data: Row[] = [{ id: "1", title: "Item A" }];

describe("DataTable", () => {
  it("renderiza headers e linhas", () => {
    const html = renderToString(<DataTable columns={columns} data={data} />);
    expect(html).toContain("Título");
    expect(html).toContain("Item A");
  });

  it("mostra mensagem de vazio quando não há dados", () => {
    const html = renderToString(<DataTable columns={columns} data={[]} emptyMessage="Nenhum item" />);
    expect(html).toContain("Nenhum item");
  });
});
