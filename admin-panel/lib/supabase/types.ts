export interface Database {
  public: {
    Tables: {
      subscription_plans: {
      Row: {
        id: string;
        name: string;
        name_ar: string | null;
        description: string | null;
        price_monthly: number;
        price_yearly: number;
        max_employees: number;
        max_suppliers: number;
        max_rfqs_per_month: number;
        max_purchase_orders: number;
        features: string[];
        is_active: boolean;
        sort_order: number;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        name: string;
        name_ar?: string;
        description?: string;
        price_monthly?: number;
        price_yearly?: number;
        max_employees?: number;
        max_suppliers?: number;
        max_rfqs_per_month?: number;
        max_purchase_orders?: number;
        features?: string[];
        is_active?: boolean;
        sort_order?: number;
      };
      Update: Partial<Database['public']['Tables']['subscription_plans']['Insert']>;
        Relationships: [];
    };
    organizations: {
      Row: {
        id: string;
        name: string;
        name_ar: string | null;
        slug: string;
        email: string;
        phone: string | null;
        address: string | null;
        country: string | null;
        plan_id: string | null;
        status: string;
        trial_ends_at: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        name: string;
        name_ar?: string;
        slug: string;
        email: string;
        phone?: string;
        address?: string;
        country?: string;
        plan_id?: string;
        status?: string;
        trial_ends_at?: string;
      };
      Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
        Relationships: [];
    };
    subscriptions: {
      Row: {
        id: string;
        org_id: string;
        plan_id: string;
        status: string;
        billing_cycle: string;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        plan_id: string;
        status?: string;
        billing_cycle?: string;
        current_period_start?: string;
        current_period_end?: string;
        cancel_at_period_end?: boolean;
      };
      Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>;
        Relationships: [];
    };
    organization_members: {
      Row: {
        id: string;
        org_id: string;
        user_id: string;
        role: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        user_id: string;
        role?: string;
        is_active?: boolean;
      };
      Update: Partial<Database['public']['Tables']['organization_members']['Insert']>;
        Relationships: [];
    };
    saas_admins: {
      Row: {
        id: string;
        user_id: string;
        role: string;
        created_at: string;
      };
      Insert: {
        id?: string;
        user_id: string;
        role?: string;
      };
      Update: Partial<Database['public']['Tables']['saas_admins']['Insert']>;
        Relationships: [];
    };
    company_settings: {
      Row: {
        id: string;
        org_id: string;
        name_en: string | null;
        name_ar: string | null;
        logo_url: string | null;
        address: string | null;
        phone: string | null;
        email: string | null;
        tax_number: string | null;
        currency: string;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        name_en?: string;
        name_ar?: string;
        logo_url?: string;
        address?: string;
        phone?: string;
        email?: string;
        tax_number?: string;
        currency?: string;
      };
      Update: Partial<Database['public']['Tables']['company_settings']['Insert']>;
        Relationships: [];
    };
    suppliers: {
      Row: {
        id: string;
        org_id: string;
        supplier_id: string | null;
        name: string;
        contact_person: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        category: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        supplier_id?: string;
        name: string;
        contact_person?: string;
        email?: string;
        phone?: string;
        address?: string;
        category?: string;
        is_active?: boolean;
      };
      Update: Partial<Database['public']['Tables']['suppliers']['Insert']>;
        Relationships: [];
    };
    supplier_categories: {
      Row: {
        id: string;
        org_id: string;
        name: string;
        created_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        name: string;
      };
      Update: Partial<Database['public']['Tables']['supplier_categories']['Insert']>;
        Relationships: [];
    };
    items: {
      Row: {
        id: string;
        org_id: string;
        item_id: string | null;
        part_no: string | null;
        description: string;
        uom: string | null;
        reference_price: number | null;
        category: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        item_id?: string;
        part_no?: string;
        description: string;
        uom?: string;
        reference_price?: number;
        category?: string;
      };
      Update: Partial<Database['public']['Tables']['items']['Insert']>;
        Relationships: [];
    };
    rfqs: {
      Row: {
        id: string;
        org_id: string;
        internal_rfq_no: string;
        customer_rfq_no: string;
        customer_rfq_date: string | null;
        required_response_date: string | null;
        status: string;
        created_by: string | null;
        notes: string | null;
        expires_at: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        internal_rfq_no: string;
        customer_rfq_no: string;
        customer_rfq_date?: string;
        required_response_date?: string;
        status?: string;
        created_by?: string;
        notes?: string;
        expires_at?: string;
      };
      Update: Partial<Database['public']['Tables']['rfqs']['Insert']>;
        Relationships: [];
    };
    rfq_items: {
      Row: {
        id: string;
        org_id: string;
        rfq_id: string;
        item_id: string | null;
        line_item: string | null;
        part_no: string | null;
        description: string;
        uom: string | null;
        qty: number | null;
        reference_price: number | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        rfq_id: string;
        item_id?: string;
        line_item?: string;
        part_no?: string;
        description: string;
        uom?: string;
        qty?: number;
        reference_price?: number;
      };
      Update: Partial<Database['public']['Tables']['rfq_items']['Insert']>;
        Relationships: [];
    };
    sent_log: {
      Row: {
        id: string;
        org_id: string;
        rfq_id: string;
        supplier_id: string;
        sent_by: string | null;
        token: string;
        close_date: string | null;
        link_opened: boolean;
        open_count: number;
        first_opened_at: string | null;
        last_opened_at: string | null;
        offer_submitted: boolean;
        created_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        rfq_id: string;
        supplier_id: string;
        sent_by?: string;
        token: string;
        close_date?: string;
        link_opened?: boolean;
        open_count?: number;
        first_opened_at?: string;
        last_opened_at?: string;
        offer_submitted?: boolean;
      };
      Update: Partial<Database['public']['Tables']['sent_log']['Insert']>;
        Relationships: [];
    };
    offers: {
      Row: {
        id: string;
        org_id: string;
        rfq_id: string;
        supplier_id: string;
        sent_log_id: string | null;
        submitted_by: string | null;
        total_price: number | null;
        general_notes: string | null;
        status: string;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        rfq_id: string;
        supplier_id: string;
        sent_log_id?: string;
        submitted_by?: string;
        total_price?: number;
        general_notes?: string;
        status?: string;
      };
      Update: Partial<Database['public']['Tables']['offers']['Insert']>;
        Relationships: [];
    };
    offer_items: {
      Row: {
        id: string;
        org_id: string;
        offer_id: string;
        rfq_item_id: string;
        price: number;
        tax_included: boolean;
        delivery_days: number | null;
        notes: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        offer_id: string;
        rfq_item_id: string;
        price: number;
        tax_included?: boolean;
        delivery_days?: number;
        notes?: string;
      };
      Update: Partial<Database['public']['Tables']['offer_items']['Insert']>;
        Relationships: [];
    };
    purchase_orders: {
      Row: {
        id: string;
        org_id: string;
        internal_po_no: string;
        external_po_no: string;
        receiver_name: string | null;
        receiver_phone: string | null;
        status: string;
        created_by: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        internal_po_no: string;
        external_po_no: string;
        receiver_name?: string;
        receiver_phone?: string;
        status?: string;
        created_by?: string;
        notes?: string;
      };
      Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>;
        Relationships: [];
    };
    purchase_order_items: {
      Row: {
        id: string;
        org_id: string;
        po_id: string;
        item_id: string | null;
        line_item: string | null;
        part_no: string | null;
        description: string;
        uom: string | null;
        qty: number | null;
        reference_price: number | null;
        tax_included: boolean;
        supplier_id: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        po_id: string;
        item_id?: string;
        line_item?: string;
        part_no?: string;
        description: string;
        uom?: string;
        qty?: number;
        reference_price?: number;
        tax_included?: boolean;
        supplier_id?: string;
      };
      Update: Partial<Database['public']['Tables']['purchase_order_items']['Insert']>;
        Relationships: [];
    };
    audit_log: {
      Row: {
        id: string;
        org_id: string;
        action: string;
        entity_type: string | null;
        entity_id: string | null;
        member_id: string | null;
        description: string;
        ip_address: string | null;
        user_agent: string | null;
        created_at: string;
      };
      Insert: {
        id?: string;
        org_id: string;
        action: string;
        entity_type?: string;
        entity_id?: string;
        member_id?: string;
        description: string;
        ip_address?: string;
        user_agent?: string;
      };
      Update: Partial<Database['public']['Tables']['audit_log']['Insert']>;
        Relationships: [];
    };
    };
    Views: { [key: string]: any };
    Functions: { [key: string]: any };
  };
}
