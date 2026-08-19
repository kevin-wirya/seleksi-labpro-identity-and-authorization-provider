'use client';
import {useState,useEffect} from 'react';
import {getUsers,createUser,updateUserStatus,toggleUserMfa,getGroups,createGroup,assignUserToGroup,removeUserFromGroup,getApplications,createApplication,addRedirectUri,deleteRedirectUri,createPolicy,deletePolicy,getAuditLogs,User,Group,Application,AuditLogItem} from '../lib/api';

const IconShield=()=>(<svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>);
const IconBarChart=()=>(<svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>);
const IconLock=()=>(<svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>);
const IconUser=()=>(<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>);
const IconUsers=()=>(<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>);
const IconGlobe=()=>(<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>);
const IconPolicy=()=>(<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>);
const IconPlus=()=>(<svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>);
const IconUserPlus=()=>(<svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>);
const IconRefresh=()=>(<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>);
const IconLink=()=>(<svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>);
const IconPulse=()=>(<svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>);
const IconExternal=()=>(<svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>);

function formatDateGMT7(dateInput: Date | string){
    if(!dateInput)return '-';
    return new Date(dateInput).toLocaleString('en-GB',{timeZone:'Asia/Jakarta'})+' GMT+7';
}

export default function Home(){
    const[activeTab,setActiveTab]=useState<'users'|'groups'|'apps'|'policies'|'logs'>('users');
    const[users,setUsers]=useState<User[]>([]);
    const[groups,setGroups]=useState<Group[]>([]);
    const[applications,setApplications]=useState<Application[]>([]);
    const[auditLogs,setAuditLogs]=useState<AuditLogItem[]>([]);
    const[loading,setLoading]=useState<boolean>(true);
    const[error,setError]=useState<string>('');
    const[success,setSuccess]=useState<string>('');

    // user form state
    const[userName,setUserName]=useState<string>('');
    const[userEmail,setUserEmail]=useState<string>('');
    const[userPassword,setUserPassword]=useState<string>('');
    const[userStatus,setUserStatus]=useState<'active'|'inactive'>('active');
    const[userMfaEnabled,setUserMfaEnabled]=useState<boolean>(false);

    // group form state
    const[groupName,setGroupName]=useState<string>('');
    const[groupDesc,setGroupDesc]=useState<string>('');

    // assign user form state
    const[assignUserId,setAssignUserId]=useState<string>('');
    const[assignGroupId,setAssignGroupId]=useState<string>('');

    // application form state
    const[appName,setAppName]=useState<string>('');
    const[appClientId,setAppClientId]=useState<string>('');
    const[appLaunchUrl,setAppLaunchUrl]=useState<string>('');
    const[appLogoutUrl,setAppLogoutUrl]=useState<string>('');

    // add redirect uri form state
    const[selectedAppForUri,setSelectedAppForUri]=useState<string>('');
    const[newRedirectUri,setNewRedirectUri]=useState<string>('');

    // policy form state
    const[policyAppId,setPolicyAppId]=useState<string>('');
    const[policyGroupId,setPolicyGroupId]=useState<string>('');
    const[policyEffect,setPolicyEffect]=useState<'allow'|'deny'>('allow');

    useEffect(()=>{
        loadData();
    },[]);

    const loadData=async()=>{
        setLoading(true);
        setError('');
        try{
            const[userData,groupData,appData,logData]=await Promise.all([getUsers(),getGroups(),getApplications(),getAuditLogs()]);
            setUsers(userData);
            setGroups(groupData);
            setApplications(appData);
            setAuditLogs(logData);
            if(userData.length>0)setAssignUserId(userData[0].id);
            if(groupData.length>0){
                setAssignGroupId(groupData[0].id);
                setPolicyGroupId(groupData[0].id);
            }
            if(appData.length>0){
                setSelectedAppForUri(appData[0].id);
                setPolicyAppId(appData[0].id);
            }
        }catch(err: any){
            setError(err.message||'Failed to load data');
        }finally{
            setLoading(false);
        }
    };

    const handleCreateUser=async(e: React.FormEvent)=>{
        e.preventDefault();
        setError('');
        setSuccess('');
        try{
            await createUser({name:userName,email:userEmail,password:userPassword,status:userStatus,mfa_enabled:userMfaEnabled});
            setSuccess('User created successfully!');
            setUserName('');
            setUserEmail('');
            setUserPassword('');
            setUserMfaEnabled(false);
            loadData();
        }catch(err: any){
            setError(err.message);
        }
    };

    const handleToggleStatus=async(userId: string,currentStatus: 'active'|'inactive')=>{
        setError('');
        setSuccess('');
        const nextStatus=currentStatus==='active'?'inactive':'active';
        try{
            await updateUserStatus(userId,nextStatus);
            setSuccess(`User status updated to ${nextStatus}!`);
            loadData();
        }catch(err: any){
            setError(err.message);
        }
    };

    const handleToggleMfa=async(userId: string,currentMfa: boolean)=>{
        setError('');
        setSuccess('');
        const nextMfa=!currentMfa;
        try{
            await toggleUserMfa(userId,nextMfa);
            setSuccess(`MFA status updated to ${nextMfa?'Enabled':'Disabled'}!`);
            loadData();
        }catch(err: any){
            setError(err.message);
        }
    };

    const handleCreateGroup=async(e: React.FormEvent)=>{
        e.preventDefault();
        setError('');
        setSuccess('');
        try{
            await createGroup({name:groupName,description:groupDesc});
            setSuccess('Group created successfully!');
            setGroupName('');
            setGroupDesc('');
            loadData();
        }catch(err: any){
            setError(err.message);
        }
    };

    const handleAssignUser=async(e: React.FormEvent)=>{
        e.preventDefault();
        if(!assignUserId||!assignGroupId)return;
        setError('');
        setSuccess('');
        try{
            await assignUserToGroup({user_id:assignUserId,group_id:assignGroupId});
            setSuccess('User assigned to group successfully!');
            loadData();
        }catch(err: any){
            setError(err.message);
        }
    };

    const handleRemoveUserFromGroup=async(userId: string, groupId: string)=>{
        setError('');
        setSuccess('');
        try{
            await removeUserFromGroup({user_id:userId,group_id:groupId});
            setSuccess('User removed from group successfully!');
            loadData();
        }catch(err: any){
            setError(err.message);
        }
    };

    const handleCreateApp=async(e: React.FormEvent)=>{
        e.preventDefault();
        setError('');
        setSuccess('');
        try{
            await createApplication({name:appName,client_id:appClientId,launch_url:appLaunchUrl,logout_notification_url:appLogoutUrl});
            setSuccess('Application registered successfully!');
            setAppName('');
            setAppClientId('');
            setAppLaunchUrl('');
            setAppLogoutUrl('');
            loadData();
        }catch(err: any){
            setError(err.message);
        }
    };

    const handleAddRedirectUri=async(e: React.FormEvent)=>{
        e.preventDefault();
        if(!selectedAppForUri||!newRedirectUri)return;
        setError('');
        setSuccess('');
        try{
            await addRedirectUri(selectedAppForUri,newRedirectUri);
            setSuccess('Redirect URI added successfully!');
            setNewRedirectUri('');
            loadData();
        }catch(err: any){
            setError(err.message);
        }
    };

    const handleDeleteRedirectUri=async(appId: string, uriId: string)=>{
        setError('');
        setSuccess('');
        try{
            await deleteRedirectUri(appId, uriId);
            setSuccess('Redirect URI removed successfully!');
            loadData();
        }catch(err: any){
            setError(err.message);
        }
    };

    const handleCreatePolicy=async(e: React.FormEvent)=>{
        e.preventDefault();
        if(!policyAppId||!policyGroupId)return;
        setError('');
        setSuccess('');
        try{
            await createPolicy(policyAppId,{group_id:policyGroupId,effect:policyEffect});
            setSuccess('Group Access Policy granted successfully!');
            loadData();
        }catch(err: any){
            setError(err.message);
        }
    };

    const handleDeletePolicy=async(appId: string, policyId: string)=>{
        setError('');
        setSuccess('');
        try{
            await deletePolicy(appId, policyId);
            setSuccess('Policy revoked successfully!');
            loadData();
        }catch(err: any){
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-black text-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-zinc-800 pb-6 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <IconShield/> SSO Admin Control Panel
                        </h1>
                        <p className="text-zinc-400 text-sm mt-1">
                            Central Identity Management and Access Control
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2.5 mt-4 md:mt-0">
                        <a href="http://localhost:4000/metrics-ui" target="_blank" rel="noopener noreferrer" className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3.5 py-2 rounded-lg font-medium transition flex items-center gap-2">
                            <IconBarChart/> Observability
                        </a>
                        <a href="http://localhost:4000/api/auth/mfa-ui" target="_blank" rel="noopener noreferrer" className="bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 text-amber-300 text-xs px-3.5 py-2 rounded-lg font-medium transition flex items-center gap-2">
                            <IconLock/> MFA Portal
                        </a>
                        <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer" className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3.5 py-2 rounded-lg font-medium transition flex items-center gap-2">
                            <IconExternal/> App A
                        </a>
                        <a href="http://localhost:3002" target="_blank" rel="noopener noreferrer" className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-3.5 py-2 rounded-lg font-medium transition flex items-center gap-2">
                            <IconExternal/> App B
                        </a>
                        <a href="http://localhost:4000/health/ready" target="_blank" rel="noopener noreferrer" className="bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-300 text-xs px-3.5 py-2 rounded-lg font-medium transition flex items-center gap-2">
                            <IconPulse/> Health Probe
                        </a>
                    </div>
                </header>

                {error&&<div className="mb-6 p-4 rounded-xl text-sm border bg-red-950 text-red-300 border-red-800">{error}</div>}
                {success&&<div className="mb-6 p-4 rounded-xl text-sm border bg-emerald-950 text-emerald-300 border-emerald-800">{success}</div>}

                {/* Tabs */}
                <div className="flex border-b border-zinc-800 mb-6 gap-2">
                    <button onClick={()=>setActiveTab('users')} className={`px-4 py-2 font-medium text-sm border-b-2 transition flex items-center gap-2 ${activeTab==='users'?'border-sky-400 text-sky-400':'border-transparent text-zinc-400 hover:text-zinc-200'}`}>
                        <IconUser/> User Management
                    </button>
                    <button onClick={()=>setActiveTab('groups')} className={`px-4 py-2 font-medium text-sm border-b-2 transition flex items-center gap-2 ${activeTab==='groups'?'border-sky-400 text-sky-400':'border-transparent text-zinc-400 hover:text-zinc-200'}`}>
                        <IconUsers/> Group Management
                    </button>
                    <button onClick={()=>setActiveTab('apps')} className={`px-4 py-2 font-medium text-sm border-b-2 transition flex items-center gap-2 ${activeTab==='apps'?'border-sky-400 text-sky-400':'border-transparent text-zinc-400 hover:text-zinc-200'}`}>
                        <IconGlobe/> Relying Applications
                    </button>
                    <button onClick={()=>setActiveTab('policies')} className={`px-4 py-2 font-medium text-sm border-b-2 transition flex items-center gap-2 ${activeTab==='policies'?'border-sky-400 text-sky-400':'border-transparent text-zinc-400 hover:text-zinc-200'}`}>
                        <IconPolicy/> Access Policies
                    </button>
                    <button onClick={()=>setActiveTab('logs')} className={`px-4 py-2 font-medium text-sm border-b-2 transition flex items-center gap-2 ${activeTab==='logs'?'border-sky-400 text-sky-400':'border-transparent text-zinc-400 hover:text-zinc-200'}`}>
                        <IconPulse/> Activity Audit Logs
                    </button>
                </div>

                {/* TAB 1: USERS */}
                {activeTab==='users'&&(
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <IconPlus/> Add New User
                            </h2>
                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
                                    <input type="text" required value={userName} onChange={(e)=>setUserName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Email</label>
                                    <input type="email" required value={userEmail} onChange={(e)=>setUserEmail(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Password</label>
                                    <input type="password" required value={userPassword} onChange={(e)=>setUserPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Status</label>
                                    <select value={userStatus} onChange={(e)=>setUserStatus(e.target.value as any)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                    <input type="checkbox" id="mfa_checkbox" checked={userMfaEnabled} onChange={(e)=>setUserMfaEnabled(e.target.checked)} className="rounded bg-zinc-950 border-zinc-800 text-sky-500 focus:ring-0 w-4 h-4"/>
                                    <label htmlFor="mfa_checkbox" className="text-xs font-medium text-zinc-300 cursor-pointer">Enable MFA (Multi-Factor Auth)</label>
                                </div>
                                <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm py-2.5 rounded-lg transition">
                                    Create User
                                </button>
                            </form>
                        </div>

                        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-white">Users List</h2>
                                <button onClick={loadData} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5">
                                    <IconRefresh/> Refresh
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-zinc-950 text-xs text-zinc-400 uppercase border-b border-zinc-800">
                                        <tr>
                                            <th className="p-3">Name</th>
                                            <th className="p-3">Email</th>
                                            <th className="p-3">Groups</th>
                                            <th className="p-3">Status</th>
                                            <th className="p-3">MFA</th>
                                            <th className="p-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {loading?(
                                            <tr><td colSpan={6} className="p-4 text-center text-zinc-500">Loading users...</td></tr>
                                        ):users.length===0?(
                                            <tr><td colSpan={6} className="p-4 text-center text-zinc-500">No users found.</td></tr>
                                        ):users.map((u)=>(
                                            <tr key={u.id} className="hover:bg-zinc-800/50">
                                                <td className="p-3 font-medium text-white">{u.name}</td>
                                                <td className="p-3">{u.email}</td>
                                                <td className="p-3">
                                                    {u.user_groups&&u.user_groups.length>0?u.user_groups.map((ug)=>(
                                                        <span key={ug.group.id} className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs px-2 py-0.5 rounded mr-1 inline-flex items-center gap-1.5 font-medium">
                                                            <span>{ug.group.name}</span>
                                                            <button onClick={()=>handleRemoveUserFromGroup(u.id,ug.group.id)} className="text-red-400 hover:text-red-300 font-bold hover:bg-red-950/60 rounded px-1 transition" title="Remove user from group">
                                                                ×
                                                            </button>
                                                        </span>
                                                    )):<span className="text-zinc-600">-</span>}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${u.status==='active'?'bg-emerald-950 text-emerald-400 border border-emerald-500/30':'bg-red-950 text-red-400 border border-red-500/30'}`}>
                                                        {u.status}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${u.mfa_enabled?'bg-purple-950 text-purple-400 border border-purple-500/30':'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                                                        {u.mfa_enabled?'Enabled':'Disabled'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right space-x-2">
                                                    <button onClick={()=>handleToggleStatus(u.id,u.status)} className="text-xs text-amber-400 hover:underline font-medium">
                                                        Toggle Status
                                                    </button>
                                                    <button onClick={()=>handleToggleMfa(u.id,!!u.mfa_enabled)} className="text-xs text-purple-400 hover:underline font-medium">
                                                        Toggle MFA
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: GROUPS */}
                {activeTab==='groups'&&(
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <IconPlus/> Create Group
                                </h2>
                                <form onSubmit={handleCreateGroup} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Group Name</label>
                                        <input type="text" required placeholder="e.g. app-a-users" value={groupName} onChange={(e)=>setGroupName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                                        <textarea rows={3} value={groupDesc} onChange={(e)=>setGroupDesc(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500"/>
                                    </div>
                                    <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm py-2.5 rounded-lg transition">
                                        Save Group
                                    </button>
                                </form>
                            </div>

                            <hr className="border-zinc-800"/>

                            <div>
                                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <IconUserPlus/> Assign User to Group
                                </h2>
                                <form onSubmit={handleAssignUser} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Select User</label>
                                        <select value={assignUserId} onChange={(e)=>setAssignUserId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                                            {users.map((u)=>(
                                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Select Group</label>
                                        <select value={assignGroupId} onChange={(e)=>setAssignGroupId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                                            {groups.map((g)=>(
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm py-2.5 rounded-lg transition">
                                        Assign to Group
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-white">Groups List</h2>
                                <button onClick={loadData} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5">
                                    <IconRefresh/> Refresh
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-zinc-950 text-xs text-zinc-400 uppercase border-b border-zinc-800">
                                        <tr>
                                            <th className="p-3">Group Name</th>
                                            <th className="p-3">Description</th>
                                            <th className="p-3">Members</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {loading?(
                                            <tr><td colSpan={3} className="p-4 text-center text-zinc-500">Loading groups...</td></tr>
                                        ):groups.length===0?(
                                            <tr><td colSpan={3} className="p-4 text-center text-zinc-500">No groups found.</td></tr>
                                        ):groups.map((g)=>(
                                            <tr key={g.id} className="hover:bg-zinc-800/50">
                                                <td className="p-3 font-medium text-white">{g.name}</td>
                                                <td className="p-3 text-zinc-400">{g.description||'-'}</td>
                                                <td className="p-3 font-semibold text-sky-400">{g._count?.user_groups ?? g.user_groups?.length ?? 0} users</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3: APPLICATIONS */}
                {activeTab==='apps'&&(
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <IconPlus/> Register Application
                                </h2>
                                <form onSubmit={handleCreateApp} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Application Name</label>
                                        <input type="text" required placeholder="e.g. App A" value={appName} onChange={(e)=>setAppName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Client ID</label>
                                        <input type="text" required placeholder="e.g. app-a" value={appClientId} onChange={(e)=>setAppClientId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Launch URL</label>
                                        <input type="text" placeholder="http://localhost:3001" value={appLaunchUrl} onChange={(e)=>setAppLaunchUrl(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500"/>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Logout Webhook URL</label>
                                        <input type="text" placeholder="http://app-a:3001/api/logout-webhook" value={appLogoutUrl} onChange={(e)=>setAppLogoutUrl(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500"/>
                                    </div>
                                    <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm py-2.5 rounded-lg transition">
                                        Register App
                                    </button>
                                </form>
                            </div>

                            <hr className="border-zinc-800"/>

                            <div>
                                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <IconLink/> Add Redirect URI
                                </h2>
                                <form onSubmit={handleAddRedirectUri} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Select Application</label>
                                        <select value={selectedAppForUri} onChange={(e)=>setSelectedAppForUri(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                                            {applications.map((app)=>(
                                                <option key={app.id} value={app.id}>{app.name} ({app.client_id})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1">Redirect URI</label>
                                        <input type="text" required placeholder="http://localhost:3001/api/auth/callback" value={newRedirectUri} onChange={(e)=>setNewRedirectUri(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500"/>
                                    </div>
                                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2.5 rounded-lg transition">
                                        Add Redirect URI
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-white">Registered Applications</h2>
                                <button onClick={loadData} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5">
                                    <IconRefresh/> Refresh
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-zinc-950 text-xs text-zinc-400 uppercase border-b border-zinc-800">
                                        <tr>
                                            <th className="p-3">App Name</th>
                                            <th className="p-3">Client ID</th>
                                            <th className="p-3">Redirect URIs</th>
                                            <th className="p-3">Webhook URL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {loading?(
                                            <tr><td colSpan={4} className="p-4 text-center text-zinc-500">Loading applications...</td></tr>
                                        ):applications.length===0?(
                                            <tr><td colSpan={4} className="p-4 text-center text-zinc-500">No applications registered.</td></tr>
                                        ):applications.map((app)=>(
                                            <tr key={app.id} className="hover:bg-zinc-800/50">
                                                <td className="p-3 font-medium text-white">{app.name}</td>
                                                <td className="p-3 font-mono text-xs text-sky-400">{app.client_id}</td>
                                                <td className="p-3">
                                                    {app.redirect_uris&&app.redirect_uris.length>0?app.redirect_uris.map((r)=>(
                                                        <div key={r.id} className="font-mono text-xs text-zinc-400 flex items-center justify-between gap-2 py-0.5">
                                                            <span>{r.redirect_uri}</span>
                                                            <button onClick={()=>handleDeleteRedirectUri(app.id,r.id)} className="text-red-400 hover:text-red-300 font-bold px-1.5 rounded hover:bg-red-950/50 transition" title="Delete Redirect URI">
                                                                ×
                                                            </button>
                                                        </div>
                                                    )):<span className="text-zinc-600">-</span>}
                                                </td>
                                                <td className="p-3 font-mono text-xs text-zinc-400">{app.logout_notification_url||'-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 4: ACCESS POLICIES */}
                {activeTab==='policies'&&(
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
                            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <IconPlus/> Create Access Policy
                            </h2>
                            <form onSubmit={handleCreatePolicy} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Select Application</label>
                                    <select value={policyAppId} onChange={(e)=>setPolicyAppId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                                        {applications.map((app)=>(
                                            <option key={app.id} value={app.id}>{app.name} ({app.client_id})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Select Group</label>
                                    <select value={policyGroupId} onChange={(e)=>setPolicyGroupId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                                        {groups.map((g)=>(
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Effect</label>
                                    <select value={policyEffect} onChange={(e)=>setPolicyEffect(e.target.value as any)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                                        <option value="allow">ALLOW</option>
                                        <option value="deny">DENY</option>
                                    </select>
                                </div>
                                <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm py-2.5 rounded-lg transition">
                                    Grant Policy
                                </button>
                            </form>
                        </div>

                        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-white">Active Access Policies</h2>
                                <button onClick={loadData} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5">
                                    <IconRefresh/> Refresh
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-zinc-950 text-xs text-zinc-400 uppercase border-b border-zinc-800">
                                        <tr>
                                            <th className="p-3">Application</th>
                                            <th className="p-3">Allowed Group</th>
                                            <th className="p-3">Effect</th>
                                            <th className="p-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {loading?(
                                            <tr><td colSpan={4} className="p-4 text-center text-zinc-500">Loading policies...</td></tr>
                                        ):applications.flatMap((app)=>(app.group_policies||[]).map((p)=>({policy:p,app}))).length===0?(
                                            <tr><td colSpan={4} className="p-4 text-center text-zinc-500">No policies created yet.</td></tr>
                                        ):applications.flatMap((app)=>(app.group_policies||[]).map((p)=>({policy:p,app}))).map(({policy,app})=>(
                                            <tr key={policy.id} className="hover:bg-zinc-800/50">
                                                <td className="p-3 font-medium text-white">{app.name} ({app.client_id})</td>
                                                <td className="p-3 font-semibold text-sky-400">{policy.group?policy.group.name:policy.group_id}</td>
                                                <td className="p-3">
                                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${policy.effect==='allow'?'bg-emerald-950 text-emerald-400 border border-emerald-500/30':'bg-red-950 text-red-400 border border-red-500/30'}`}>
                                                        {policy.effect.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button onClick={()=>handleDeletePolicy(app.id,policy.id)} className="px-2.5 py-1 text-xs bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800/80 rounded transition">
                                                        Revoke
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 5: AUDIT LOGS */}
                {activeTab==='logs'&&(
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <IconPulse/> Central Security Audit Logs
                            </h2>
                            <button onClick={loadData} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 rounded-lg flex items-center gap-1.5 transition">
                                <IconRefresh/> Refresh Logs
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-zinc-300">
                                <thead className="bg-zinc-950 text-zinc-400 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="p-3">Time (GMT+7)</th>
                                        <th className="p-3">Event Type</th>
                                        <th className="p-3">Actor / User</th>
                                        <th className="p-3">Result</th>
                                        <th className="p-3">Metadata</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/80">
                                    {loading?(
                                        <tr><td colSpan={5} className="p-4 text-center text-zinc-500">Loading audit logs...</td></tr>
                                    ):auditLogs.length===0?(
                                        <tr><td colSpan={5} className="p-4 text-center text-zinc-500">No audit logs recorded yet.</td></tr>
                                    ):auditLogs.map((log)=>(
                                        <tr key={log.id} className="hover:bg-zinc-800/50">
                                            <td className="p-3 text-zinc-400 text-xs font-mono whitespace-nowrap">{formatDateGMT7(log.created_at)}</td>
                                            <td className="p-3 font-semibold text-sky-400 font-mono">{log.event_type}</td>
                                            <td className="p-3 text-xs text-zinc-300 font-mono">{log.user_id||log.actor_id||'-'}</td>
                                            <td className="p-3">
                                                <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${log.result==='success'||log.result==='granted'?'bg-emerald-950 text-emerald-400 border border-emerald-500/30':'bg-red-950 text-red-400 border border-red-500/30'}`}>
                                                    {log.result}
                                                </span>
                                            </td>
                                            <td className="p-3 text-xs font-mono text-zinc-400 max-w-md truncate">{log.metadata||'-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
