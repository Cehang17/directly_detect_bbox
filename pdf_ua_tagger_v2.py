import json, sys, os

try:
    import pikepdf
    from pikepdf import Dictionary, Array, Name, String
except ImportError:
    print("Uyarı: 'pikepdf' kütüphanesi kurulu değil. Kurmak için: pip install pikepdf")
    pikepdf = None

def build_table_struct(pdf, table, parent_ref):
    a11y = table.get("accessibility", {})
    cell_a11y = a11y.get("cells", {})

    table_elem = Dictionary(Type=Name.StructElem, S=Name.Table, P=parent_ref, K=Array([]))
    title_parts = [p for p in [a11y.get("caption"), a11y.get("summary")] if p]
    if title_parts:
        table_elem["/T"] = String(" — ".join(title_parts))
    table_ref = pdf.make_indirect(table_elem)

    rows = {}
    for c in table.get("cells", []):
        r = c.get("row", 0)
        rows.setdefault(r, []).append(c)

    header_refs = {}
    for row_idx in sorted(rows):
        tr_elem = Dictionary(Type=Name.StructElem, S=Name.TR, P=table_ref, K=Array([]))
        tr_ref = pdf.make_indirect(tr_elem)
        for cell in sorted(rows[row_idx], key=lambda c: c.get("col", 0)):
            cell_id = cell.get("id", f"c_{cell.get('row',0)}_{cell.get('col',0)}")
            info = cell_a11y.get(cell_id, {"role": "th" if cell.get("is_header") or cell.get("isHeader") or cell.get("row") == 0 else "td", "scope": None, "headers": []})
            tr_elem["/K"].append(build_cell_struct(pdf, cell, info, tr_ref, header_refs))
        table_elem["/K"].append(tr_ref)
    return table_ref

def build_cell_struct(pdf, cell, info, parent_ref, header_refs):
    tag = Name.TH if info.get("role") == "th" else Name.TD
    elem = Dictionary(Type=Name.StructElem, S=tag, P=parent_ref, K=Array([]))

    if "mcid" in cell and "page_ref" in cell:
        elem["/K"].append(Dictionary(Type=Name.MCR, Pg=cell["page_ref"], MCID=cell["mcid"]))

    attr = Dictionary(O=Name.Table)
    scope_map = {"col": Name.Column, "row": Name.Row, "colgroup": Name.Both, "rowgroup": Name.Both}

    cell_id = cell.get("id", f"c_{cell.get('row',0)}_{cell.get('col',0)}")

    if info.get("role") == "th":
        if info.get("scope") in scope_map:
            attr["/Scope"] = scope_map[info["scope"]]
        elem["/A"] = attr
        ref = pdf.make_indirect(elem)
        header_refs[cell_id] = ref
        return ref

    if info.get("headers"):
        valid_headers = [header_refs[h] for h in info["headers"] if h in header_refs]
        if valid_headers:
            attr["/Headers"] = Array(valid_headers)
            elem["/A"] = attr
    return pdf.make_indirect(elem)

def apply_tags(input_pdf, output_pdf, enriched_json_path):
    if pikepdf is None:
        raise RuntimeError("pikepdf kütüphanesi bulunamadı. Lütfen 'pip install pikepdf' komutunu çalıştırın.")

    with open(enriched_json_path, encoding="utf-8") as f:
        doc = json.load(f)
    pdf = pikepdf.open(input_pdf)

    if "/StructTreeRoot" not in pdf.Root:
        pdf.Root.StructTreeRoot = pdf.make_indirect(Dictionary(Type=Name.StructTreeRoot, K=Array([])))
    struct_root = pdf.Root.StructTreeRoot
    doc_elem = pdf.make_indirect(Dictionary(Type=Name.StructElem, S=Name.Document, P=struct_root, K=Array([])))
    struct_root["/K"].append(doc_elem)

    tables = doc.get("tables", [])
    if not tables and isinstance(doc, dict) and "cells" in doc:
        tables = [doc]

    for table in tables:
        doc_elem["/K"].append(build_table_struct(pdf, table, doc_elem))

    with pdf.open_metadata() as meta:
        meta["pdfuaid:part"] = "1"
    pdf.Root.Lang = String("tr-TR")
    pdf.Root.MarkInfo = Dictionary(Marked=True)
    pdf.save(output_pdf)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Kullanım: python pdf_ua_tagger_v2.py <input.pdf> <output.pdf> <enriched.json>")
        sys.exit(1)
    apply_tags(sys.argv[1], sys.argv[2], sys.argv[3])
    print(f"Başarıyla PDF/UA etiketlendi: {sys.argv[2]}")
