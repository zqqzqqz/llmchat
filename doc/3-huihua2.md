对于会话关于现在我需要做如下调整 
1、页面初始加载后检查根据当 localStorage 存储 检查有没有当前选中智能体的id，如没有则创建一个当前智能体的id的字典，agentId:[{
  id: string;              // 时间戳字符串(会话id)
  title: string;           // 会话标题（取自首条消息前30字符）
  agentId: string;         // 关联的智能体ID
  messages: ChatMessage[{"AI": string, "HUMAN": string,"id":string,"feedback":string},{"AI": string, "HUMAN": string,"id":string,"feedback":string}]; // 消息列表
  createdAt: Date;         // 创建时间
  updatedAt: Date;         // 更新时间
},
{
  id: string;              // 时间戳字符串(会话id)
  title: string;           // 会话标题（取自首条消息前30字符）
  agentId: string;         // 关联的智能体ID
  messages: ChatMessage[{"AI": string, "HUMAN": string,"id":string,"feedback":string},{"AI": string, "HUMAN": string,"id":string,"feedback":string}]; // 消息列表
  createdAt: Date;         // 创建时间
  updatedAt: Date;         // 更新时间
}]
2、切换智能体后，检查根据当 localStorage 存储 检查有没有当前选中智能体的id，如没有则创建一个当前智能体的id的字典，agentId:[{
  id: string;              // 时间戳字符串(会话id)
  title: string;           // 会话标题（取自首条消息前30字符）
  agentId: string;         // 关联的智能体ID
  messages: ChatMessage[{"AI": string, "HUMAN": string,"id":string,"feedback":string},{"AI": string, "HUMAN": string,"id":string,"feedback":string}]; // 消息列表
  createdAt: Date;         // 创建时间
  updatedAt: Date;         // 更新时间
},{
  id: string;              // 时间戳字符串(会话id)
  title: string;           // 会话标题（取自首条消息前30字符）
  agentId: string;         // 关联的智能体ID
  messages: ChatMessage[{"AI": string, "HUMAN": string,"id":string,"feedback":string},{"AI": string, "HUMAN": string,"id":string,"feedback":string}]; // 消息列表
  createdAt: Date;         // 创建时间
  updatedAt: Date;         // 更新时间
}]

侧边栏显示当前智能体的会话列表，则需要根据当前智能体的id，从 localStorage 存储中获取会话列表，并显示在侧边栏中。如agentId:[{
  id: string;              // 时间戳字符串(会话id)
  title: string;           // 会话标题（取自首条消息前30字符）
  agentId: string;         // 关联的智能体ID
  messages: ChatMessage[{"AI": string, "HUMAN": string,"id":string,"feedback":string},{"AI": string, "HUMAN": string,"id":string,"feedback":string}]; // 消息列表
  createdAt: Date;         // 创建时间
  updatedAt: Date;         // 更新时间
},
{
  id: string;              // 时间戳字符串(会话id)
  title: string;           // 会话标题（取自首条消息前30字符）
  agentId: string;         // 关联的智能体ID
  messages: ChatMessage[{"AI": string, "HUMAN": string,"id":string,"feedback":string},{"AI": string, "HUMAN": string,"id":string,"feedback":string}]; // 消息列表
  createdAt: Date;         // 创建时间
  updatedAt: Date;         // 更新时间
}]就显示两个会话标题，点击会话标题，则显示该会话的详细内容，如 messages: ChatMessage[{"AI": string, "HUMAN": string,"id":string,"feedback":string},{"AI": string, "HUMAN": string,"id":string,"feedback":string}]; // 消息列表

3、开启新对话，agentId:[{
  id: string;              // 时间戳字符串(会话id)
  title: string;           // 会话标题（取自首条消息前30字符）
  agentId: string;         // 关联的智能体ID
  messages: ChatMessage[{"AI": string, "HUMAN": string,"id":string,"feedback":string},{"AI": string, "HUMAN": string,"id":string,"feedback":string}]; // 消息列表
  createdAt: Date;         // 创建时间
  updatedAt: Date;         // 更新时间
}]就增加一个字典数据然后messages为空如就变成了agentId:[{
  id: string;              // 时间戳字符串(会话id)
  title: string;           // 会话标题（取自首条消息前30字符）
  agentId: string;         // 关联的智能体ID
  messages: ChatMessage[{"AI": string, "HUMAN": string,"id":string,"feedback":string},{"AI": string, "HUMAN": string,"id":string,"feedback":string}]; // 消息列表
  createdAt: Date;         // 创建时间
  updatedAt: Date;         // 更新时间
},{
  id: string;              // 时间戳字符串(会话id)
  title: string;           // 会话标题（取自首条消息前30字符）
  agentId: string;         // 关联的智能体ID
  messages: ChatMessage[]; // 消息列表
  createdAt: Date;         // 创建时间
  updatedAt: Date;         // 更新时间
}]