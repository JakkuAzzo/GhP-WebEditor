#!/usr/bin/env node
const http = require('http');

const data = JSON.stringify({
  url: 'https://github.com/octocat/Hello-World.git',
  shallow: true
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/clone',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
    
    if (res.statusCode === 200) {
      const result = JSON.parse(body);
      console.log('\nClone ID:', result.id);
      
      // Now test the tree endpoint
      const treeOptions = {
        hostname: 'localhost',
        port: 3001,
        path: `/api/clone/${result.id}/tree`,
        method: 'GET'
      };
      
      const treeReq = http.request(treeOptions, (treeRes) => {
        let treeBody = '';
        treeRes.on('data', (chunk) => treeBody += chunk);
        treeRes.on('end', () => {
          console.log('\nTree Response Status:', treeRes.statusCode);
          const treeData = JSON.parse(treeBody);
          console.log('Files count:', treeData.files.length);
          console.log('First few files:', treeData.files.slice(0, 5));
          
          // Test fetching a file
          if (treeData.files.length > 0) {
            const firstFile = treeData.files.find(f => f.type === 'file');
            if (firstFile) {
              const fileOptions = {
                hostname: 'localhost',
                port: 3001,
                path: `/api/clone/${result.id}/file?path=${encodeURIComponent(firstFile.path)}`,
                method: 'GET'
              };
              
              const fileReq = http.request(fileOptions, (fileRes) => {
                let fileBody = '';
                fileRes.on('data', (chunk) => fileBody += chunk);
                fileRes.on('end', () => {
                  console.log('\nFile Response Status:', fileRes.statusCode);
                  const fileData = JSON.parse(fileBody);
                  console.log('File path:', fileData.path);
                  console.log('Content length:', fileData.content?.length || 0);
                  console.log('Content preview:', fileData.content?.substring(0, 100));
                });
              });
              
              fileReq.on('error', (e) => console.error('File request error:', e));
              fileReq.end();
            }
          }
        });
      });
      
      treeReq.on('error', (e) => console.error('Tree request error:', e));
      treeReq.end();
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.write(data);
req.end();
