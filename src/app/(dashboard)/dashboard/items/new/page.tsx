import { ItemForm } from "@/components/item-form";

export default function NewItemPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Novo item</h1>
      <ItemForm mode="create" />
    </div>
  );
}