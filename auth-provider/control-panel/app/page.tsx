'use client';
import {useState,useEffect} from 'react';
import {getUsers,createUser,updateUserStatus,getGroups,createGroup,assignUserToGroup,User,Group} from '../lib/api';

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

export default function Home(){
    const[activeTab,setActiveTab]=useState<'users'|'groups'|'apps'|'policies'>('users');
    const[users,setUsers]=useState<User[]>([]);
    const[groups,setGroups]=useState<Group[]>([]);
    const[loading,setLoading]=useState<boolean>(true);
    const[error,setError]=useState<string>('');
    const[success,setSuccess]=useState<string>('');

    // user form state
    const[userName,setUserName]=useState<string>('');
    const[userEmail,setUserEmail]=useState<string>('');
    const[userPassword,setUserPassword]=useState<string>('');
    const[userStatus,setUserStatus]=useState<'active'|'inactive'>('active');

    // group form state
    const[groupName,setGroupName]=useState<string>('');
    const[groupDesc,setGroupDesc]=useState<string>('');

    // assign user form state
    const[assignUserId,setAssignUserId]=useState<string>('');
    const[assignGroupId,setAssignGroupId]=useState<string>('');

    useEffect(()=>{
        loadData();
    },[]);

    const loadData=async()=>{
        setLoading(true);
        setError('');
        try{
            const[userData,groupData]=await Promise.all([getUsers(),getGroups()]);
            setUsers(userData);
            setGroups(groupData);
            if(userData.length>0)setAssignUserId(userData[0].id);
            if(groupData.length>0)setAssignGroupId(groupData[0].id);
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
            await createUser({name:userName,email:userEmail,password:userPassword,status:userStatus});
            setSuccess('User created successfully!');
            setUserName('');
            setUserEmail('');
            setUserPassword('');
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
                    <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
                        <a href="http://localhost:4000/metrics-ui" target="_blank" rel="noopener noreferrer" className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-4 py-2 rounded-lg font-medium transition flex items-center gap-2">
                            <IconBarChart/> Observability
                        </a>
                        <a href="http://localhost:4000/api/auth/mfa-ui" target="_blank" rel="noopener noreferrer" className="bg-amber-950 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-xs px-4 py-2 rounded-lg font-medium transition flex items-center gap-2">
                            <IconLock/> MFA Portal
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
                                            <th className="p-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800">
                                        {loading?(
                                            <tr><td colSpan={5} className="p-4 text-center text-zinc-500">Loading users...</td></tr>
                                        ):users.length===0?(
                                            <tr><td colSpan={5} className="p-4 text-center text-zinc-500">No users found.</td></tr>
                                        ):users.map((u)=>(
                                            <tr key={u.id} className="hover:bg-zinc-800/50">
                                                <td className="p-3 font-medium text-white">{u.name}</td>
                                                <td className="p-3">{u.email}</td>
                                                <td className="p-3">
                                                    {u.user_groups&&u.user_groups.length>0?u.user_groups.map((ug)=>(
                                                        <span key={ug.group.id} className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded mr-1">
                                                            {ug.group.name}
                                                        </span>
                                                    )):<span className="text-zinc-600">-</span>}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${u.status==='active'?'bg-emerald-950 text-emerald-400 border border-emerald-500/30':'bg-red-950 text-red-400 border border-red-500/30'}`}>
                                                        {u.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button onClick={()=>handleToggleStatus(u.id,u.status)} className="text-xs text-amber-400 hover:underline font-medium">
                                                        Toggle Status
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
                                                <td className="p-3 font-semibold text-sky-400">{g.user_groups?g.user_groups.length:0} users</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 3 & 4 PLACEHOLDERS */}
                {(activeTab==='apps'||activeTab==='policies')&&(
                    <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl text-center">
                        <p className="text-zinc-400 text-sm">Applications and Policies Management tab will be loaded in the next step.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
