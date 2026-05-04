export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_profiles: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_admin: boolean
          is_system: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_admin?: boolean
          is_system?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_admin?: boolean
          is_system?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      acessos: {
        Row: {
          aluno_id: string | null
          created_at: string
          id: string
          matricula_tentada: string | null
          metodo: Database["public"]["Enums"]["acesso_metodo"]
          observacao: string | null
          registrado_por: string | null
          status: Database["public"]["Enums"]["acesso_status"]
          tipo: Database["public"]["Enums"]["acesso_tipo"]
        }
        Insert: {
          aluno_id?: string | null
          created_at?: string
          id?: string
          matricula_tentada?: string | null
          metodo: Database["public"]["Enums"]["acesso_metodo"]
          observacao?: string | null
          registrado_por?: string | null
          status: Database["public"]["Enums"]["acesso_status"]
          tipo: Database["public"]["Enums"]["acesso_tipo"]
        }
        Update: {
          aluno_id?: string | null
          created_at?: string
          id?: string
          matricula_tentada?: string | null
          metodo?: Database["public"]["Enums"]["acesso_metodo"]
          observacao?: string | null
          registrado_por?: string | null
          status?: Database["public"]["Enums"]["acesso_status"]
          tipo?: Database["public"]["Enums"]["acesso_tipo"]
        }
        Relationships: [
          {
            foreignKeyName: "acessos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      alunos: {
        Row: {
          created_at: string
          curso: string
          deleted_at: string | null
          id: string
          matricula: string
          nome: string
          status: Database["public"]["Enums"]["aluno_status"]
          turma: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          curso: string
          deleted_at?: string | null
          id?: string
          matricula: string
          nome: string
          status?: Database["public"]["Enums"]["aluno_status"]
          turma: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          curso?: string
          deleted_at?: string | null
          id?: string
          matricula?: string
          nome?: string
          status?: Database["public"]["Enums"]["aluno_status"]
          turma?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          categoria: string
          key: string
          label: string
        }
        Insert: {
          categoria: string
          key: string
          label: string
        }
        Update: {
          categoria?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      profile_permissions: {
        Row: {
          permission_key: string
          profile_id: string
        }
        Insert: {
          permission_key: string
          profile_id: string
        }
        Update: {
          permission_key?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "profile_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_profile_id: string | null
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          numero_usuario: string | null
          updated_at: string
        }
        Insert: {
          access_profile_id?: string | null
          ativo?: boolean
          created_at?: string
          email: string
          id: string
          nome: string
          numero_usuario?: string | null
          updated_at?: string
        }
        Update: {
          access_profile_id?: string | null
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          numero_usuario?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_access_profile_id_fkey"
            columns: ["access_profile_id"]
            isOneToOne: false
            referencedRelation: "access_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_permissions: { Args: never; Returns: string[] }
      has_permission: { Args: { _key: string; _uid: string }; Returns: boolean }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      resolve_login_identifier: {
        Args: { _identifier: string }
        Returns: string
      }
    }
    Enums: {
      acesso_metodo: "biometria" | "manual"
      acesso_status: "valido" | "invalido"
      acesso_tipo: "entrada" | "saida"
      aluno_status: "ativo" | "inativo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acesso_metodo: ["biometria", "manual"],
      acesso_status: ["valido", "invalido"],
      acesso_tipo: ["entrada", "saida"],
      aluno_status: ["ativo", "inativo"],
    },
  },
} as const
