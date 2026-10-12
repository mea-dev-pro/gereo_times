/**
 * Types de la base GereoTimes.
 * Écrits à la main pour refléter supabase/migrations/*.sql.
 * À remplacer par `supabase gen types typescript` une fois les migrations appliquées.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// --- Types énumérés -----------------------------------------------------------
export type OrgRole = "employee" | "manager" | "hr" | "admin";
export type MemberStatus = "active" | "inactive";
export type TimeEntryStatus = "open" | "closed" | "corrected" | "flagged";
export type TimeEntrySource = "clock" | "manual";
export type BreakKind = "paid" | "unpaid";
export type AdjustmentStatus = "pending" | "approved" | "rejected" | "cancelled";
export type RequestStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "skipped";
export type HalfDay = "am" | "pm";
export type LedgerMovement =
  | "accrual"
  | "carryover"
  | "expiry"
  | "correction"
  | "reservation"
  | "release"
  | "consumption"
  | "restitution";
export type AccrualFrequency = "none" | "monthly" | "quarterly" | "yearly";

// --- Définition d'une table ---------------------------------------------------
type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      organizations: TableDef<{
        id: string;
        name: string;
        slug: string;
        legal_name: string | null;
        country_code: string;
        timezone: string;
        locale: string;
        currency: string;
        created_at: string;
        updated_at: string;
      }>;

      profiles: TableDef<{
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
        phone: string | null;
        locale: string;
        created_at: string;
        updated_at: string;
      }>;

      departments: TableDef<{
        id: string;
        organization_id: string;
        name: string;
        code: string | null;
        manager_member_id: string | null;
        created_at: string;
        updated_at: string;
      }>;

      work_schedules: TableDef<{
        id: string;
        organization_id: string;
        name: string;
        timezone: string;
        weekly_pattern: Json;
        daily_hours: number;
        break_minutes: number;
        is_default: boolean;
        created_at: string;
        updated_at: string;
      }>;

      organization_members: TableDef<{
        id: string;
        organization_id: string;
        user_id: string;
        role: OrgRole;
        status: MemberStatus;
        department_id: string | null;
        manager_id: string | null;
        work_schedule_id: string | null;
        job_title: string | null;
        employee_number: string | null;
        hire_date: string | null;
        end_date: string | null;
        weekly_hours: number | null;
        timezone: string | null;
        invited_by: string | null;
        joined_at: string;
        created_at: string;
        updated_at: string;
      }>;

      holidays: TableDef<{
        id: string;
        organization_id: string;
        name: string;
        holiday_date: string;
        is_recurring: boolean;
        country_code: string | null;
        created_at: string;
      }>;

      leave_types: TableDef<{
        id: string;
        organization_id: string;
        code: string;
        name: string;
        is_paid: boolean;
        requires_justification: boolean;
        color: string;
        active: boolean;
        created_at: string;
        updated_at: string;
      }>;

      leave_policies: TableDef<{
        id: string;
        organization_id: string;
        leave_type_id: string;
        name: string;
        effective_from: string;
        effective_to: string | null;
        accrual_frequency: AccrualFrequency;
        accrual_amount: number;
        carryover_max: number | null;
        carryover_expiry_months: number | null;
        proration: boolean;
        waiting_period_days: number;
        min_notice_days: number;
        max_consecutive_days: number | null;
        allow_half_days: boolean;
        allow_negative_balance: boolean;
        approval_levels: number;
        created_at: string;
        updated_at: string;
      }>;

      leave_requests: TableDef<{
        id: string;
        organization_id: string;
        member_id: string;
        leave_type_id: string;
        start_date: string;
        end_date: string;
        start_half: HalfDay | null;
        end_half: HalfDay | null;
        total_days: number;
        business_days: number | null;
        reason: string | null;
        status: RequestStatus;
        submitted_at: string | null;
        decided_at: string | null;
        cancelled_at: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;

      leave_approvals: TableDef<{
        id: string;
        organization_id: string;
        leave_request_id: string;
        level: number;
        approver_member_id: string | null;
        status: ApprovalStatus;
        comment: string | null;
        decided_at: string | null;
        created_at: string;
      }>;

      leave_ledger: TableDef<{
        id: string;
        organization_id: string;
        member_id: string;
        leave_type_id: string;
        movement: LedgerMovement;
        amount: number;
        effective_date: string;
        reference_type: string | null;
        reference_id: string | null;
        note: string | null;
        created_by: string | null;
        created_at: string;
      }>;

      time_entries: TableDef<{
        id: string;
        organization_id: string;
        member_id: string;
        work_date: string;
        clock_in: string;
        clock_out: string | null;
        status: TimeEntryStatus;
        source: TimeEntrySource;
        break_minutes: number;
        worked_minutes: number | null;
        effective_minutes: number | null;
        planned_minutes: number | null;
        variance_minutes: number | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      }>;

      break_entries: TableDef<{
        id: string;
        organization_id: string;
        time_entry_id: string;
        started_at: string;
        ended_at: string | null;
        minutes: number | null;
        kind: BreakKind;
        created_at: string;
      }>;

      time_adjustments: TableDef<{
        id: string;
        organization_id: string;
        time_entry_id: string | null;
        member_id: string;
        requested_by: string | null;
        reason: string;
        original_in: string | null;
        original_out: string | null;
        new_in: string | null;
        new_out: string | null;
        status: AdjustmentStatus;
        decided_by: string | null;
        decided_at: string | null;
        decision_comment: string | null;
        created_at: string;
        updated_at: string;
      }>;

      notifications: TableDef<{
        id: string;
        organization_id: string;
        member_id: string;
        kind: string;
        title: string;
        body: string | null;
        link: string | null;
        payload: Json;
        read_at: string | null;
        created_at: string;
      }>;

      audit_logs: TableDef<{
        id: number;
        organization_id: string | null;
        actor_user_id: string | null;
        actor_member_id: string | null;
        action: string;
        entity_type: string;
        entity_id: string | null;
        before: Json | null;
        after: Json | null;
        ip_address: string | null;
        user_agent: string | null;
        created_at: string;
      }>;
    };

    Views: {
      leave_balances: {
        Row: {
          organization_id: string;
          member_id: string;
          leave_type_id: string;
          accrued_days: number;
          used_days: number;
          reserved_days: number;
          expired_days: number;
          available_days: number;
        };
        Relationships: [];
      };
    };

    Functions: {
      create_organization: {
        Args: {
          p_name: string;
          p_slug: string;
          p_country_code?: string;
          p_timezone?: string;
          p_locale?: string;
        };
        Returns: string;
      };
      clock_in: { Args: { p_organization_id: string }; Returns: string };
      clock_out: {
        Args: { p_organization_id: string; p_note?: string | null };
        Returns: string;
      };
      start_break: {
        Args: { p_organization_id: string; p_kind?: BreakKind };
        Returns: string;
      };
      end_break: { Args: { p_organization_id: string }; Returns: string };
      request_time_adjustment: {
        Args: {
          p_organization_id: string;
          p_time_entry_id: string;
          p_new_in: string | null;
          p_new_out: string | null;
          p_reason: string;
        };
        Returns: string;
      };
      decide_time_adjustment: {
        Args: {
          p_adjustment_id: string;
          p_approve: boolean;
          p_comment?: string | null;
        };
        Returns: undefined;
      };
      submit_leave_request: {
        Args: {
          p_organization_id: string;
          p_leave_type_id: string;
          p_start_date: string;
          p_end_date: string;
          p_start_half?: HalfDay | null;
          p_end_half?: HalfDay | null;
          p_reason?: string | null;
        };
        Returns: string;
      };
      decide_leave_request: {
        Args: {
          p_request_id: string;
          p_approve: boolean;
          p_comment?: string | null;
        };
        Returns: undefined;
      };
      cancel_leave_request: {
        Args: { p_request_id: string; p_reason?: string | null };
        Returns: undefined;
      };
      accrue_leave: {
        Args: {
          p_organization_id: string;
          p_period_start: string;
          p_period_end: string;
        };
        Returns: number;
      };
      adjust_leave_balance: {
        Args: {
          p_organization_id: string;
          p_member_id: string;
          p_leave_type_id: string;
          p_amount: number;
          p_effective_date: string;
          p_note: string;
        };
        Returns: string;
      };
      leave_available_days: {
        Args: {
          p_organization_id: string;
          p_member_id: string;
          p_leave_type_id: string;
        };
        Returns: number;
      };
      compute_leave_days: {
        Args: {
          p_organization_id: string;
          p_member_id: string;
          p_start: string;
          p_end: string;
          p_start_half?: HalfDay | null;
          p_end_half?: HalfDay | null;
        };
        Returns: number;
      };
    };

    Enums: {
      org_role: OrgRole;
      member_status: MemberStatus;
      time_entry_status: TimeEntryStatus;
      time_entry_source: TimeEntrySource;
      break_kind: BreakKind;
      adjustment_status: AdjustmentStatus;
      request_status: RequestStatus;
      approval_status: ApprovalStatus;
      half_day: HalfDay;
      ledger_movement: LedgerMovement;
      accrual_frequency: AccrualFrequency;
    };

    CompositeTypes: Record<never, never>;
  };
};

// --- Raccourcis pratiques -----------------------------------------------------
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"];
export type Functions<T extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][T];
