import { ItemForm } from "@/components/item-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageContainer } from "@/components/layout/page-container";

export default function NewItemPage() {
  return (
    <PageContainer size="default">
<PageHeader title="Novo item" />
          <ItemForm mode="create" />
      </PageContainer>
  );
}
