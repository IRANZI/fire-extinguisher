import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination as PaginationType } from "../types";

export const Pagination = ({
  pagination,
  onPage,
}: {
  pagination: PaginationType;
  onPage: (page: number) => void;
}) => (
  <div className="flex flex-col items-center justify-between gap-3 border-t border-sand px-4 py-3 text-sm text-slate-500 sm:flex-row">
    <span>
      Showing page <strong className="text-ink">{pagination.page}</strong> of{" "}
      <strong className="text-ink">{Math.max(pagination.pages, 1)}</strong> · {pagination.total} record(s)
    </span>
    <div className="flex gap-2">
      <button className="btn-secondary !px-3 !py-2" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>
        <ChevronLeft size={16} /> Previous
      </button>
      <button className="btn-secondary !px-3 !py-2" disabled={pagination.page >= pagination.pages} onClick={() => onPage(pagination.page + 1)}>
        Next <ChevronRight size={16} />
      </button>
    </div>
  </div>
);

