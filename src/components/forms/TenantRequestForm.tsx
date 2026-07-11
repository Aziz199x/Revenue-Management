import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TenantRequest, RequestStatus, RequestPriority } from "@/data/types";
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
} from "@/data/labels";
import { todayISO } from "@/data/helpers";

export interface TenantRequestFormValues {
  title: string;
  type: string;
  description: string;
  requestDate: string;
  expectedCompletionDate?: string;
  priority: RequestPriority;
  status: RequestStatus;
  cost?: number;
  technicianName?: string;
  tenantName?: string;
  tenantPhone?: string;
  notes?: string;
}

interface Props {
  initial?: TenantRequest;
  onSubmit: (values: TenantRequestFormValues) => void;
}

const CUSTOM_TYPE_KEY = "__custom__";

export default function TenantRequestForm({ initial, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const hasKnownType = initial?.type && initial.type in REQUEST_TYPE_LABELS;
  const [selectType, setSelectType] = useState(hasKnownType ? initial!.type : CUSTOM_TYPE_KEY);
  const [customType, setCustomType] = useState(!hasKnownType ? (initial?.type ?? "") : "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [requestDate, setRequestDate] = useState(initial?.requestDate ?? todayISO());
  const [expectedCompletionDate, setExpectedCompletionDate] = useState(initial?.expectedCompletionDate ?? "");
  const [priority, setPriority] = useState<RequestPriority>(initial?.priority ?? "medium");
  const [status, setStatus] = useState<RequestStatus>(initial?.status ?? "new");
  const [cost, setCost] = useState(initial?.cost?.toString() ?? "");
  const [technicianName, setTechnicianName] = useState(initial?.technicianName ?? "");
  const [tenantName, setTenantName] = useState(initial?.tenantName ?? "");
  const [tenantPhone, setTenantPhone] = useState(initial?.tenantPhone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const effectiveType = selectType === CUSTOM_TYPE_KEY ? customType : selectType;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSubmit({
          title: title.trim(),
          type: effectiveType || "other",
          description: description.trim(),
          requestDate,
          expectedCompletionDate: expectedCompletionDate || undefined,
          priority,
          status,
          cost: cost ? Number(cost) : undefined,
          technicianName: technicianName.trim() || undefined,
          tenantName: tenantName.trim() || undefined,
          tenantPhone: tenantPhone.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }}
    >
      <div className="space-y-1.5">
        <Label>عنوان الطلب *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>نوع الطلب</Label>
          <Select value={selectType} onValueChange={setSelectType}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
              <SelectItem value={CUSTOM_TYPE_KEY}>نوع مخصص</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>الأولوية</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as RequestPriority)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(REQUEST_PRIORITY_LABELS) as RequestPriority[]).map((p) => (
                <SelectItem key={p} value={p}>{REQUEST_PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {selectType === CUSTOM_TYPE_KEY && (
        <Input value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="اكتب نوع الطلب" className="rounded-xl" />
      )}
      <div className="space-y-1.5">
        <Label>وصف الطلب</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>تاريخ الطلب</Label>
          <Input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>تاريخ الإنجاز المتوقع</Label>
          <Input type="date" value={expectedCompletionDate} onChange={(e) => setExpectedCompletionDate(e.target.value)} className="rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>اسم المستأجر</Label>
          <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>جوال المستأجر</Label>
          <Input value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} inputMode="tel" dir="ltr" className="rounded-xl text-right" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>الحالة</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as RequestStatus)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(REQUEST_STATUS_LABELS) as RequestStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{REQUEST_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>التكلفة</Label>
          <Input type="number" inputMode="decimal" min={0} value={cost} onChange={(e) => setCost(e.target.value)} className="rounded-xl" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>الفني / المقاول</Label>
        <Input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
      </div>
      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "إضافة الطلب"}
      </Button>
    </form>
  );
}
