import { ItemForm } from "@/components/item-form";
import { PageHeader } from "@/components/layout/page-header";

export default function NewItemPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader title="Novo item" />
          <ItemForm mode="create" />
      </main>
    </div>
  );
}
