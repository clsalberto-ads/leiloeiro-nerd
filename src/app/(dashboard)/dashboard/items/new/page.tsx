import { ItemForm } from "@/components/item-form";
import { PageHeader } from "@/components/layout/page-header";

export default function NewItemPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Novo item" />
      <ItemForm mode="create" />
    </div>
  );
}
