const getBaseUrl=()=>{
    if(typeof window!=='undefined'){
        return process.env.NEXT_PUBLIC_AUTH_PROVIDER_URL||'http://localhost:4000';
    }
    return process.env.NEXT_PUBLIC_AUTH_PROVIDER_URL||'http://localhost:4000';
};

export interface User{
    id: string;
    name: string;
    email: string;
    status: 'active' | 'inactive';
    mfa_enabled?: boolean;
    created_at: string;
    updated_at?: string;
    user_groups:{
        group:{
            id: string;
            name: string;
            description?: string;
        };
    }[];
}

export interface Group{
    id: string;
    name: string;
    description?: string;
    created_at: string;
    user_groups?:{user_id: string}[];
    _count?:{user_groups: number};
}

export interface RedirectUri{
    id: string;
    redirect_uri: string;
}

export interface GroupPolicy{
    id: string;
    group_id: string;
    effect: 'allow' | 'deny';
    group?:{
        id: string;
        name: string;
    };
}

export interface Application{
    id: string;
    name: string;
    client_id: string;
    status: string;
    launch_url?: string;
    logout_notification_url?: string;
    redirect_uris: RedirectUri[];
    group_policies?: GroupPolicy[];
}

export async function getAdminSession(): Promise<User>{
    const res=await fetch(`${getBaseUrl()}/api/admin/me`,{cache:'no-store',credentials:'include'});
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Unauthorized');
    return json.user;
}

export async function getUsers(): Promise<User[]>{
    const res=await fetch(`${getBaseUrl()}/api/admin/users`,{cache:'no-store',credentials:'include'});
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to fetch users');
    return json.data;
}

export async function createUser(payload:{name: string; email: string; password: string; status?: string; mfa_enabled?: boolean; group_ids?: string[]}): Promise<User>{
    const res=await fetch(`${getBaseUrl()}/api/admin/users`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify(payload),
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to create user');
    return json.data;
}

export async function updateUser(userId: string,data:{name?:string;email?:string;password?:string;status?:string}): Promise<User>{
    const res=await fetch(`${getBaseUrl()}/api/admin/users/${userId}`,{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify(data),
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to update user');
    return json.data;
}

export async function updateUserStatus(userId: string,status: 'active' | 'inactive'): Promise<User>{
    const res=await fetch(`${getBaseUrl()}/api/admin/users/${userId}/status`,{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify({status}),
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to update user status');
    return json.data;
}

export async function toggleUserMfa(userId: string,mfa_enabled: boolean): Promise<User>{
    const res=await fetch(`${getBaseUrl()}/api/admin/users/${userId}/mfa`,{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify({mfa_enabled}),
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to toggle MFA status');
    return json.data;
}

export async function getGroups(): Promise<Group[]>{
    const res=await fetch(`${getBaseUrl()}/api/admin/groups`,{cache:'no-store',credentials:'include'});
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to fetch groups');
    return json.data;
}

export async function createGroup(payload:{name: string; description?: string}): Promise<Group>{
    const res=await fetch(`${getBaseUrl()}/api/admin/groups`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify(payload),
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to create group');
    return json.data;
}

export async function assignUserToGroup(payload:{user_id: string; group_id: string}): Promise<any>{
    const res=await fetch(`${getBaseUrl()}/api/admin/groups/assign`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify(payload),
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to assign user to group');
    return json.data;
}

export async function removeUserFromGroup(payload:{user_id: string; group_id: string}): Promise<any>{
    const res=await fetch(`${getBaseUrl()}/api/admin/groups/assign`,{
        method:'DELETE',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify(payload),
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to remove user from group');
    return json;
}

export async function getApplications(): Promise<Application[]>{
    const res=await fetch(`${getBaseUrl()}/api/admin/applications`,{cache:'no-store',credentials:'include'});
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to fetch applications');
    return json.data;
}

export async function createApplication(payload:{name: string; client_id: string; launch_url?: string; logout_notification_url?: string}): Promise<Application>{
    const res=await fetch(`${getBaseUrl()}/api/admin/applications`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify(payload),
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to create application');
    return json.data;
}

export async function addRedirectUri(applicationId: string,redirect_uri: string): Promise<any>{
    const res=await fetch(`${getBaseUrl()}/api/admin/applications/${applicationId}/redirect-uris`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify({redirect_uri}),
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to add redirect URI');
    return json.data;
}

export async function deleteRedirectUri(applicationId: string,uriId: string): Promise<any>{
    const res=await fetch(`${getBaseUrl()}/api/admin/applications/${applicationId}/redirect-uris/${uriId}`,{
        method:'DELETE',
        credentials:'include',
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to delete redirect URI');
    return json;
}

export async function createPolicy(applicationId: string,payload:{group_id: string; effect: string}): Promise<any>{
    const res=await fetch(`${getBaseUrl()}/api/admin/applications/${applicationId}/policies`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body:JSON.stringify(payload),
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to create group policy');
    return json.data;
}

export async function deletePolicy(applicationId: string,policyId: string): Promise<any>{
    const res=await fetch(`${getBaseUrl()}/api/admin/applications/${applicationId}/policies/${policyId}`,{
        method:'DELETE',
        credentials:'include',
    });
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to delete policy');
    return json;
}

export interface AuditLogItem{
    id: string;
    event_type: string;
    actor_id?: string;
    user_id?: string;
    application_id?: string;
    result: string;
    metadata?: string;
    ip_address?: string;
    created_at: string;
}

export async function getAuditLogs(): Promise<AuditLogItem[]>{
    const res=await fetch(`${getBaseUrl()}/api/admin/audit-logs`,{cache:'no-store',credentials:'include'});
    const json=await res.json();
    if(!json.success)throw new Error(json.error||'Failed to fetch audit logs');
    return json.data;
}