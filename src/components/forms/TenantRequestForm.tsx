import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
<<<<<<< HEAD
import { Switch } from "@/components/ui/switch";
=======
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
<<<<<<< HEAD
import {
  TenantRequest,
  RequestType,
  RequestStatus,
  RequestPriority,
} from "@/data/types";
=======
import { TenantRequest, RequestStatus, RequestPriority } from "@/data/types";
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
import {
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_PRIORITY_LABELS,
<<<<<<< HEAD
  REQUEST_TYPES,
=======
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
} from "@/data/labels";
import { todayISO } from "@/data/helpers";

export interface TenantRequestFormValues {
<<<<<<< HEAD
  unitId: string;
  buildingId: string;
  tenantId?: string;
  title: string;
  type: RequestType;
  customType?: string;
  description: string;
  requestDate: string;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
=======
  title: string;
  type: string;
  description: string;
  requestDate: string;
  expectedCompletionDate?: string;
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
  priority: RequestPriority;
  status: RequestStatus;
  cost?: number;
  technicianName?: string;
<<<<<<< HEAD
  notes?: string;
  addedToRepairs: boolean;
=======
  tenantName?: string;
  tenantPhone?: string;
  notes?: string;
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
}

interface Props {
  initial?: TenantRequest;
<<<<<<< HEAD
  unitId: string;
  buildingId: string;
  tenantId?: string;
  tenantName?: string;
  buildingName?: string;
  unitName?: string;
  onSubmit: (values: TenantRequestFormValues) => void;
}

export default function TenantRequestForm({
  initial,
  unitId,
  buildingId,
  tenantId,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<RequestType>(initial?.type ?? "maintenance");
  const [customType, setCustomType] = useState(initial?.customType ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [requestDate, setRequestDate] = useState(initial?.requestDate ?? todayISO());
  const [expectedCompletionDate, setExpectedCompletionDate] = useState(
    initial?.expectedCompletionDate ?? "",
  );
  const [actualCompletionDate, setActualCompletionDate] = useState(
    initial?.actualCompletionDate ?? "",
  );
=======
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
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
  const [priority, setPriority] = useState<RequestPriority>(initial?.priority ?? "medium");
  const [status, setStatus] = useState<RequestStatus>(initial?.status ?? "new");
  const [cost, setCost] = useState(initial?.cost?.toString() ?? "");
  const [technicianName, setTechnicianName] = useState(initial?.technicianName ?? "");
<<<<<<< HEAD
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [addedToRepairs, setAddedToRepairs] = useState(initial?.addedToRepairs ?? false);
=======
  const [tenantName, setTenantName] = useState(initial?.tenantName ?? "");
  const [tenantPhone, setTenantPhone] = useState(initial?.tenantPhone ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const effectiveType = selectType === CUSTOM_TYPE_KEY ? customType : selectType;
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSubmit({
<<<<<<< HEAD
          unitId,
          buildingId,
          tenantId,
          title: title.trim(),
          type,
          customType: type === "other" ? customType.trim() || undefined : undefined,
          description: description.trim(),
          requestDate,
          expectedCompletionDate: expectedCompletionDate || undefined,
          actualCompletionDate: actualCompletionDate || undefined,
=======
          title: title.trim(),
          type: effectiveType || "other",
          description: description.trim(),
          requestDate,
          expectedCompletionDate: expectedCompletionDate || undefined,
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
          priority,
          status,
          cost: cost ? Number(cost) : undefined,
          technicianName: technicianName.trim() || undefined,
<<<<<<< HEAD
          notes: notes.trim() || undefined,
          addedToRepairs: status === "completed" && addedToRepairs,
=======
          tenantName: tenantName.trim() || undefined,
          tenantPhone: tenantPhone.trim() || undefined,
          notes: notes.trim() || undefined,
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
        });
      }}
    >
      <div className="space-y-1.5">
        <Label>عنوان الطلب *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="rounded-xl" />
      </div>
<<<<<<< HEAD

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>نوع الطلب *</Label>
          <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
=======
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
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
<<<<<<< HEAD
          <Label>الأولوية *</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as RequestPriority)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REQUEST_PRIORITY_LABELS) as RequestPriority[]).map((k) => (
                <SelectItem key={k} value={k}>{REQUEST_PRIORITY_LABELS[k]}</SelectItem>
=======
          <Label>الأولوية</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as RequestPriority)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(REQUEST_PRIORITY_LABELS) as RequestPriority[]).map((p) => (
                <SelectItem key={p} value={p}>{REQUEST_PRIORITY_LABELS[p]}</SelectItem>
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
<<<<<<< HEAD

      {type === "other" && (
        <div className="space-y-1.5">
          <Label>نوع الطلب (مخصص)</Label>
          <Input value={customType} onChange={(e) => setCustomType(e.target.value)} className="rounded-xl" />
        </div>
      )}

=======
      {selectType === CUSTOM_TYPE_KEY && (
        <Input value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="اكتب نوع الطلب" className="rounded-xl" />
      )}
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
      <div className="space-y-1.5">
        <Label>وصف الطلب</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl" />
      </div>
<<<<<<< HEAD

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>تاريخ الطلب *</Label>
          <Input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} required className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>الحالة *</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as RequestStatus)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REQUEST_STATUS_LABELS) as RequestStatus[]).map((k) => (
                <SelectItem key={k} value={k}>{REQUEST_STATUS_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>تاريخ الإنجاز المتوقع</Label>
          <Input type="date" value={expectedCompletionDate} onChange={(e) => setExpectedCompletionDate(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>تاريخ الإنجاز الفعلي</Label>
          <Input type="date" value={actualCompletionDate} onChange={(e) => setActualCompletionDate(e.target.value)} className="rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>التكلفة</Label>
          <Input type="number" inputMode="decimal" min={0} value={cost} onChange={(e) => setCost(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label>الفني / المقاول</Label>
          <Input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} className="rounded-xl" />
        </div>
      </div>

      {status === "completed" && cost && Number(cost) > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <div>
            <p className="text-sm font-bold">إضافة التكلفة إلى سجل الصيانة</p>
            <p className="text-xs text-muted-foreground">إضافة تكلفة الطلب إلى سجل الصيانة للوحدة</p>
          </div>
          <Switch checked={addedToRepairs} onCheckedChange={setAddedToRepairs} />
        </div>
      )}

=======
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
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
      <div className="space-y-1.5">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
      </div>
<<<<<<< HEAD

=======
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
      <Button type="submit" className="w-full rounded-xl">
        {initial ? "حفظ التعديلات" : "إضافة الطلب"}
      </Button>
    </form>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> d2e78b157cf3468e577bccd295a25e4cacab8b77
